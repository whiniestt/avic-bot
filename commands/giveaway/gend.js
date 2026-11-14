const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { QuickDB } = require("quick.db");

const db = require(process.cwd() + "/database");

module.exports = {
    name: "gend",
    aliases: ["giveawayend"],

    async execute(message, args) {

        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> You need **Manage Server** permission to end giveaways.")
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
                        .setDescription("`,gend <message id>`")
                ]
            });
        }

        const giveaway = await db.get(`giveaway_${messageId}`);

        if (!giveaway || giveaway.ended) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> No active giveaway found with that message ID.")
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

        const reaction = giveawayMessage.reactions.cache.find(r => r.emoji.id === "1535203898485112862");
        const users = reaction ? await reaction.users.fetch() : new Map();
        const entrants = [...users.values()].filter(u => !u.bot);

        await db.set(`giveaway_${messageId}.ended`, true);

        const originalEmbed = giveawayMessage.embeds[0];
        const jumpUrl = giveawayMessage.url;
        const nowTimestamp = Math.floor(Date.now() / 1000);

        const linkRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Jump to Giveaway")
                .setStyle(ButtonStyle.Link)
                .setURL(jumpUrl)
        );

        let newDescription = originalEmbed.description
            .replace(/\*\*Ends:\*\* <t:\d+:F>/, `**Ended:** <t:${nowTimestamp}:F>`);

        if (entrants.length === 0) {
            newDescription = newDescription.replace(
                /\*\*Winner\(s\):\*\* \d+/,
                `**Winner(s):** No valid entries`
            );

            const endedEmbed = EmbedBuilder.from(originalEmbed).setDescription(newDescription);

            await giveawayMessage.edit({
                content: "<a:gwyy:1534265842248847422> **Giveaway Ended** <a:gwyy:1534265842248847422>",
                embeds: [endedEmbed]
            });

            await channel.send({
                content: `<a:BlackDot:1514727923175657654> No valid entries found for **${giveaway.prize}** — no winner could be selected.`,
                components: [linkRow]
            });

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setDescription("<a:BlackDot:1514727923175657654> Giveaway ended — no valid entries.")
                ]
            });
        }

        const shuffled = entrants.sort(() => 0.5 - Math.random());
        const winners = shuffled.slice(0, giveaway.winnerCount);

        await db.set(`giveaway_${messageId}.winners`, winners.map(w => w.id));

        newDescription = newDescription.replace(
            /\*\*Winner\(s\):\*\* \d+/,
            `**Winner(s):** ${winners.map(w => `${w}`).join(", ")}`
        );

        const endedEmbed = EmbedBuilder.from(originalEmbed).setDescription(newDescription);

        await giveawayMessage.edit({
            content: "<a:gwyy:1534265842248847422> **Giveaway Ended** <a:gwyy:1534265842248847422>",
            embeds: [endedEmbed]
        });

        await channel.send({
            content: `Congratulations ${winners.map(w => `${w}`).join(", ")}, You won **${giveaway.prize}**! Hosted by <@${giveaway.hostId}>`,
            components: [linkRow]
        });

        message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("#D3D3D3")
                    .setDescription("<a:BlackDot:1514727923175657654> Giveaway ended successfully.")
            ]
        });
    }
};
