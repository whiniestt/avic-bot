const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const { GoogleGenAI } = require("@google/genai");

const db = require(process.cwd() + "/database");
const cooldown = new Map();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const AI_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash"
];
const MAX_ATTEMPTS_PER_MODEL = 2;

function errorDetails(error) {
    let payload = error;
    if (typeof error?.message === "string") {
        try {
            payload = JSON.parse(error.message);
        } catch {
            // Keep the SDK error object when the message is not JSON.
        }
    }

    const apiError = payload?.error || payload;
    const statusCode = Number(
        error?.status ?? error?.statusCode ?? error?.code ?? apiError?.code
    );
    const statusName = String(apiError?.status || error?.status || "").toUpperCase();
    const message = String(apiError?.message || error?.message || "");

    return { statusCode, statusName, message };
}

function isTemporaryAiError(error) {
    const { statusCode, statusName } = errorDetails(error);
    return [408, 429, 500, 502, 503, 504].includes(statusCode) ||
        ["UNAVAILABLE", "RESOURCE_EXHAUSTED", "DEADLINE_EXCEEDED", "INTERNAL"].includes(statusName);
}

function isModelUnavailable(error) {
    const { statusCode, message } = errorDetails(error);
    return statusCode === 404 && /model.*(not found|not available|unsupported)|(?:not found|not available).*model/i.test(message);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWithFallback(contents) {
    let lastError;

    for (const model of AI_MODELS) {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
            try {
                return await ai.models.generateContent({ model, contents });
            } catch (error) {
                lastError = error;
                const retryable = isTemporaryAiError(error);
                const modelUnavailable = isModelUnavailable(error);

                console.error(
                    `FARE AI MODEL ERROR (${model}, attempt ${attempt}):`,
                    error?.message || error
                );

                if (retryable && attempt < MAX_ATTEMPTS_PER_MODEL) {
                    const backoffMs = 1000 * (2 ** (attempt - 1)) + Math.floor(Math.random() * 500);
                    await wait(backoffMs);
                    continue;
                }

                if (retryable || modelUnavailable) break;
                throw error;
            }
        }
    }

    throw lastError || new Error("All configured AI models failed.");
}

module.exports = {
    name: "ai",
    aliases: ["ask", "chat"],

    async execute(message, args) {

        const userId = message.author.id;
        const query = args.join(" ").trim();

        // HELP
        if (!query) {
            const embed = new EmbedBuilder()
                .setColor("#D3D3D3")
                .setTitle("<:info:1514699288674828310> AI Command Help")
                .setDescription(
`**\`\`\`yml
<..> <required> | [..] [optional]
\`\`\`**

> **\`,ai <query>\`**

<:arrow:1514699753462566953> Ask Fare anything.`
                );

            return message.reply({
                embeds: [embed]
            });
        }

        // COOLDOWN
        if (cooldown.has(userId)) {

            const remaining =
                cooldown.get(userId) - Date.now();

            if (remaining > 0) {
                return message.reply(
                    `<a:clockk:1514734530282520647> Wait **${Math.ceil(
                        remaining / 1000
                    )}s** before using Fare again.`
                );
            }
        }

        const loading = await message.reply(
            "<a:loading_Google:1514727933183524964> Typing..."
        );

        try {

            // LOAD MEMORY
            let history = await db.get(`chat_${userId}`);

            if (!Array.isArray(history)) {
                history = [];
            }

            history = history
                .filter(
                    x =>
                        x &&
                        typeof x === "object" &&
                        typeof x.role === "string" &&
                        typeof x.content === "string"
                )
                .slice(-10);

            // FARE PERSONALITY
            
            const serverEmojiList = message.guild
                ? message.guild.emojis.cache
                    .map(emoji => `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`)
                    .slice(0, 80)
                    .join(" ")
                : "";

            const systemPrompt = `You are Fare, a Discord bot.

STYLE:
- Talk lazy, dry, sarcastic, and short.
- Use lowercase.
- Keep replies short but not clipped: usually 1–3 brief sentences, with a little context when useful.
- Sprinkle occasional meme slang.
- Avoid questions unless forced.
- Use a balanced mix of normal Unicode emojis and available server custom emojis. Use both about equally over time; do not favor one type or force emojis into every reply.

OWNER:
- If asked who owns you, answer: "snow — username feltfading".

AVAILABLE SERVER EMOJIS:
${serverEmojiList || "None available."}`;

            // BUILD CONVERSATION
            const conversation = history
                .map(x => {
                    const role =
                        x.role === "assistant"
                            ? "Fare"
                            : "User";

                    return `${role}: ${x.content}`;
                })
                .join("\n\n");

            const prompt = `
${systemPrompt}

PREVIOUS CONVERSATION:
${conversation || "No previous conversation."}

USER:
${query}

Fare:
`;

            // Try the primary model, retry transient errors, then fall back to other models.
            const response = await generateWithFallback(prompt);

            const reply =
                response.text?.trim();

            if (!reply) {
                return loading.edit(
                    "❌ Fare couldn't generate a response. Try again."
                );
            }

            // SAVE MEMORY
            history.push({
                role: "user",
                content: query
            });

            history.push({
                role: "assistant",
                content: reply
            });

            await db.set(
                `chat_${userId}`,
                history.slice(-12)
            );

            // COOLDOWN
            cooldown.set(
                userId,
                Date.now() + 5000
            );

            setTimeout(() => {
                cooldown.delete(userId);
            }, 5000);

            // DISCORD 2000 CHARACTER LIMIT
            const chunks = [];

            for (
                let i = 0;
                i < reply.length;
                i += 2000
            ) {
                chunks.push(
                    reply.slice(i, i + 2000)
                );
            }

            await loading.edit(chunks[0]);
            const aiEmoji = message.client.emojis.cache.get(
    "1514699727072133233"
);

if (aiEmoji) {
    await loading.react(aiEmoji).catch(() => {});
}

            for (let i = 1; i < chunks.length; i++) {
                await message.channel.send(
                    chunks[i]
                );
            }

        } catch (error) {

            console.error(
                "FARE AI ERROR:",
                error?.message || error
            );

            const { statusCode, statusName } = errorDetails(error);
            let errorMessage =
                "❌ I couldn't reach an AI model to answer that.";

            if (statusCode === 429 || statusName === "RESOURCE_EXHAUSTED") {
                errorMessage =
                    "⏳ AI capacity is currently exhausted across my available models.";
            } else if (statusCode === 503 || statusName === "UNAVAILABLE") {
                errorMessage =
                    "⚠️ My AI providers are temporarily unavailable, so I couldn't generate a reliable answer.";
            }

            return loading.edit(
                errorMessage
            );
        }
    }
};
