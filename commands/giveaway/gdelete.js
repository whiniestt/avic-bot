const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { QuickDB } = require("quick.db");

const db = require(process.cwd() + "/database");

module.exports = {
    name: "gdelete",
    aliases: ["giveawaydelete", "gcancel"],

    async execute(message, args) {

        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> You need **Manage Server** permission to delete giveaways.")
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
                        .setDescription("`,gdelete <message id>`")
                ]
            });
        }

        const giveaway = await db.get(`giveaway_${messageId}`);

        if (!giveaway) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> No giveaway found with that message ID.")
                ]
            });
        }

        const channel = await message.guild.channels.fetch(giveaway.channelId).catch(() => null);

        if (channel) {
            const giveawayMessage = await channel.messages.fetch(giveaway.messageId).catch(() => null);
            if (giveawayMessage) {
                await giveawayMessage.delete().catch(() => {});
            }
        }

        await db.delete(`giveaway_${messageId}`);

        message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("#D3D3D3")
                    .setDescription(`<a:BlackDot:1514727923175657654> Giveaway for **${giveaway.prize}** has been deleted.`)
            ]
        });
    }
};
