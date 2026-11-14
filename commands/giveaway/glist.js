const { EmbedBuilder } = require("discord.js");
const db = require("../../database");
module.exports = {
    name: "glist",
    aliases: ["giveawaylist"],

    async execute(message, args) {

        const all = await db.all();
        const giveaways = all
            .filter(entry => entry.id.startsWith("giveaway_"))
            .map(entry => entry.value)
            .filter(g => g.guildId === message.guild.id && !g.ended);

        if (giveaways.length === 0) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setDescription("<a:BlackDot:1514727923175657654> There are no active giveaways in this server.")
                ]
            });
        }

        const list = giveaways.map(g =>
            `<a:BlackDot:1514727923175657654> **${g.prize}** — [Jump](https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId})\n` +
            `> Ends <t:${Math.floor(g.endTime / 1000)}:R> • Winners: ${g.winnerCount} • ID: \`${g.messageId}\``
        ).join("\n\n");

        const embed = new EmbedBuilder()
            .setColor("#2FD6D6")
            .setTitle("<:gift:1514705355412865136> Active Giveaways")
            .setDescription(list)
            .setFooter({ text: "Developed by Elric" })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};
