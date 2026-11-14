const {
    EmbedBuilder,
    PermissionFlagsBits
} = require("discord.js");

const { QuickDB } = require("quick.db");
const ms = require("ms");

const db = require(process.cwd() + "/database");

module.exports = {
    name: "gcreate",
    aliases: ["giveawaycreate"],

    async execute(message, args) {

        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> You need **Manage Server** permission to create giveaways.")
                ]
            });
        }

        if (args.length < 3) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setTitle("<:gift:1514705355412865136> Giveaway Usage")
                        .setDescription(
"`,gcreate <duration> <winners> <prize>`\n\n**Example**\n`,gcreate 1h 1 Discord Nitro`"
)
                ]
            });
        }

        const duration = args[0];

        if (!ms(duration)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> Invalid duration.\nExample: `10m`, `1h`, `2d`, `1w`")
                ]
            });
        }

        const winnerCount = parseInt(args[1]);

        if (isNaN(winnerCount) || winnerCount < 1) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<a:spider_cross:1514728338701287640> Winners must be greater than **0**.")
                ]
            });
        }

        const prize = args.slice(2).join(" ");

        const endTimestamp = Math.floor(
            (Date.now() + ms(duration)) / 1000
        );

            const embed = new EmbedBuilder()
            .setColor("#FFFFFF")
                .setThumbnail(message.guild.iconURL({ dynamic: true, size: 1024 }))
               .setTitle(`<a:giftt:1535203788913119272> ${prize} <a:giftt:1535203788913119272>`)
            .setDescription(
`<a:BlackDot:1514727923175657654> **Hosted by:** ${message.author}
<a:BlackDot:1514727923175657654> **Winner(s):** ${winnerCount}
<a:BlackDot:1514727923175657654> **Ends:** <t:${endTimestamp}:F>

<a:BlackDot:1514727923175657654> React with **<a:booper:1535203898485112862>** below to participate.`
            )
            .setFooter({
                text: "Developed by Zen."
            })
            .setTimestamp();

        const giveawayMessage = await message.channel.send({
    content: "<a:gwyy:1534265842248847422> **New Giveaway** <a:gwyy:1534265842248847422>",
    embeds: [embed]
});

       await giveawayMessage.react("<a:booper:1535203898485112862>");

        await db.set(`giveaway_${giveawayMessage.id}`, {
            guildId: message.guild.id,
            channelId: message.channel.id,
            messageId: giveawayMessage.id,
            hostId: message.author.id,
            prize: prize,
            winnerCount: winnerCount,
            endTime: Date.now() + ms(duration),
            ended: false
        });

            

    }
};
