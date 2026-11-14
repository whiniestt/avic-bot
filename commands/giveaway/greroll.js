const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { QuickDB } = require("quick.db");

const db = require(process.cwd() + "/database");

module.exports = {
    name: "greroll",
    aliases: ["giveawayreroll"],

    async execute(message, args) {

        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> You need **Manage Server** permission to reroll giveaways.")
                ]
            });
        }

        const messageId = args[0];

        if (!messageId) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setTitle("<:gift:1514705355412865136> Giveaway Usage")
                        .setDescription("`,greroll <message id>`")
                ]
            });
        }

        const giveaway = await db.get(`giveaway_${messageId}`);

        if (!giveaway || !giveaway.ended) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> That giveaway hasn't ended yet, or doesn't exist.")
                ]
            });
        }

        const channel = await message.guild.channels.fetch(giveaway.channelId).catch(() => null);
        if (!channel) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> Couldn't find the giveaway channel.")
                ]
            });
        }

        const giveawayMessage = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (!giveawayMessage) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> Couldn't find the giveaway message.")
                ]
            });
        }

        const reaction = giveawayMessage.reactions.cache.get("booper:1535203898485112862");
        const users = reaction ? await reaction.users.fetch() : new Map();
        const entrants = [...users.values()].filter(u => !u.bot);

        if (entrants.length === 0) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> No valid entries to reroll from.")
                ]
            });
        }

        const newWinner = entrants[Math.floor(Math.random() * entrants.length)];

        await db.set(`giveaway_${messageId}.winners`, [newWinner.id]);

        const rerollEmbed = new EmbedBuilder()
            .setColor("#2FD6D6")
            .setTitle(`<a:giftt:1535203788913119272> ${giveaway.prize} <a:giftt:1535203788913119272>`)
            .setDescription(
`<a:BlackDot:1514727923175657654> **New Winner:** ${newWinner}
<a:BlackDot:1514727923175657654> **Hosted by:** <@${giveaway.hostId}>`
            )
            .setFooter({ text: "Developed by Elric" })
            .setTimestamp();

        channel.send({
            content: `<a:gwyy:1534265842248847422> New winner for **${giveaway.prize}**: ${newWinner}!`,
            embeds: [rerollEmbed]
        });

        message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("#D3D3D3")
                    .setDescription("<a:BlackDot:1514727923175657654> Giveaway rerolled successfully.")
            ]
        });
    }
};
