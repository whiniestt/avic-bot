const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const { GoogleGenAI } = require("@google/genai");

const db = require(process.cwd() + "/database");
const cooldown = new Map();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

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
- Keep replies to 1–4 words.
- Sprinkle occasional meme slang.
- Avoid questions unless forced.
- Use emojis sometimes. Prefer relevant server emojis when available; do not spam or invent them.

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

            // GEMINI
            const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt
            });

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

            let errorMessage =
                "❌ Fare is having trouble right now. Try again shortly.";

            if (
                error?.status === 429 ||
                error?.message?.includes("429")
            ) {
                errorMessage =
                    "⏳ Fare is temporarily rate-limited. Try again in a moment.";
            }

            return loading.edit(
                errorMessage
            );
        }
    }
};
