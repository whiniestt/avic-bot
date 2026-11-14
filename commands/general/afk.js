const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");

module.exports = {
    name: "afk",

    async execute(message, args) {

        const reason = args.length ? args.join(" ") : "~ Busy </>";

        const already =
            await db.get(`afk_${message.author.id}`) ||
            await db.get(`afk_${message.guild.id}_${message.author.id}`);

        if (already) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FFCC66")
                        .setDescription("<:WarningIcon:1514708751385497721> You are already AFK")
                ]
            });
        }

        // =========================
        // BUTTON PANEL
        // =========================

        const embed = new EmbedBuilder()
            .setColor("#D3D3D3")
            .setTitle("<:timerr:1514699712681218094> AFK Panel")
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .setDescription("Choose AFK mode below");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("afk_global")
                .setLabel("Global AFK")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("afk_server")
                .setLabel("Server AFK")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId("afk_close")
                .setLabel("Close")
                .setStyle(ButtonStyle.Danger)
        );

        const msg = await message.reply({
            embeds: [embed],
            components: [row]
        });

        const collector = msg.createMessageComponentCollector({
            time: 10000
        });

        collector.on("collect", async interaction => {

            if (interaction.user.id !== message.author.id) {
                return interaction.reply({
                    ephemeral: true,
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF7F7F")
                            .setDescription("<:WarningIcon:1514708751385497721> This panel isn't yours.")
                    ]
                });
            }

            if (interaction.customId === "afk_close") {
                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF7F7F")
                            .setDescription("<:Tick:1514714190500335677> AFK panel closed")
                    ],
                    components: []
                });
            }

            // =========================
            // GLOBAL AFK
            // =========================

            if (interaction.customId === "afk_global") {

                await db.set(`afk_${message.author.id}`, {
                    reason,
                    since: Date.now(),
                    type: "global",
                    mentions: 0
                });

                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#57F287")
                            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                            .setDescription(
                                `<:Tick:1514714190500335677> Global AFK set\n\n` +
                                `<:arrow:1514699753462566953> Reason • ${reason}`
                            )
                    ],
                    components: []
                });
            }

            // =========================
            // SERVER AFK
            // =========================

            if (interaction.customId === "afk_server") {

                await db.set(`afk_${message.guild.id}_${message.author.id}`, {
                    reason,
                    since: Date.now(),
                    type: "server",
                    mentions: 0
                });

                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#A9C7FF")
                            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                            .setDescription(
                                `<:Tick:1514714190500335677> Server AFK set\n\n` +
                                `<:arrow:1514699753462566953> Reason • ${reason}`
                            )
                    ],
                    components: []
                });
            }
        });

        collector.on("end", () => {
            msg.edit({ components: [] }).catch(() => {});
        });
    }
};
