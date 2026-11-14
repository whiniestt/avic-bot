const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const db = require("../database");

module.exports = (client) => {

    async function checkGiveaways() {
        const all = await db.all();
        const giveaways = all.filter(entry => entry.id.startsWith("giveaway_"));

        for (const entry of giveaways) {
            const giveaway = entry.value;

            if (giveaway.ended) continue;
            if (Date.now() < giveaway.endTime) continue;

            try {
                const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
                if (!channel) {
                    await db.set(`${entry.id}.ended`, true);
                    continue;
                }

                const giveawayMessage = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                if (!giveawayMessage) {
                    await db.set(`${entry.id}.ended`, true);
                    continue;
                }

                const reaction = giveawayMessage.reactions.cache.find(r => r.emoji.id === "1535203898485112862");
                const users = reaction ? await reaction.users.fetch() : new Map();
                const entrants = [...users.values()].filter(u => !u.bot);

                await db.set(`${entry.id}.ended`, true);

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
                    continue;
                }

                const shuffled = entrants.sort(() => 0.5 - Math.random());
                const winners = shuffled.slice(0, giveaway.winnerCount);

                await db.set(`${entry.id}.winners`, winners.map(w => w.id));

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

            } catch (err) {
                console.error(`Failed to auto-end giveaway ${entry.id}:`, err);
            }
        }
    }

    setInterval(checkGiveaways, 15000);
    checkGiveaways();
};
