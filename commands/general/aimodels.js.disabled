const { EmbedBuilder } = require("discord.js");
const OpenAI = require("openai");

const client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: "https://api.navy/v1",
});

module.exports = {
    name: "aimodels",

    async execute(message, args) {
        try {
            const res = await client.models.list();
            const ids = res.data.map((m) => m.id);

            // Discord embeds cap description at 4096 chars — chunk if needed
            const text = ids.join(", ");
            const chunks = text.match(/.{1,3900}/g) || ["(none found)"];

            for (const chunk of chunks) {
                await message.channel.send({
                    embeds: [new EmbedBuilder().setColor("#D3D3D3").setTitle("Available Models").setDescription(chunk)]
                });
            }
        } catch (err) {
            console.error("AIMODELS ERROR:", err?.message || String(err));
            message.reply(`<:WarningIcon:1514708751385497721> Error fetching models: \`${err?.message || String(err)}\``);
        }
    }
};
