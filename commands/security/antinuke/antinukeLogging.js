const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const cooldown = new Map();

module.exports = {

    name: "antinukeLogging",
    description: "Configure Antinuke logging.",

    async execute(message, args) {

        // ==========================================
        // PERMISSIONS
        // ==========================================
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription(
                            "<a:spider_cross:1514728338701287640> **Access Denied:** You need **Administrator** permissions."
                        )
                ]
            });
        }

        // ==========================================
        // COOLDOWN
        // ==========================================
        const cooldownTime = 3000;

        if (cooldown.has(message.author.id)) {

            const timeLeft = (
                (cooldown.get(message.author.id) - Date.now()) / 1000
            ).toFixed(1);

            if (timeLeft > 0) {

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF7F7F")
                            .setDescription(
                                `<:WarningIcon:1514708751385497721> You are under cooldown.\n\n` +
                                `<:arrow:1514699753462566953> Cooldown • \`${timeLeft}s\``
                            )
                    ]
                });
            }
        }

        cooldown.set(
            message.author.id,
            Date.now() + cooldownTime
        );

        setTimeout(() => {
            cooldown.delete(message.author.id);
        }, cooldownTime);

        // ==========================================
        // ANTINUKE CHECK
        // ==========================================
        const enabled = await db.get(
            `antinuke_${message.guild.id}`
        );

        if (enabled !== true) {

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription(
                            "<:WarningIcon:1514708751385497721> Antinuke is currently disabled in this server."
                        )
                ]
            });
        }

        // ==========================================
        // DATABASE KEY
        // ==========================================
        const loggingKey =
            `antinuke_logging_${message.guild.id}`;

        // ==========================================
        // DISABLE
        // ,antinuke logging disable
        // ==========================================
        if (args[1]?.toLowerCase() === "disable") {

            await db.delete(loggingKey);

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setTitle(
                            "<:shield:1514699900225323108> Antinuke Logging"
                        )
                        .setDescription(
                            "<a:Animated_Tick:1514714209085292564> Antinuke logging has been **disabled**."
                        )
                ]
            });
        }

        // ==========================================
        // SET CHANNEL
        // ,antinuke logging #channel
        // ==========================================
        const channel =
            message.mentions.channels.first() ||
            message.guild.channels.cache.get(args[1]);

        if (channel) {

            if (channel.type !== ChannelType.GuildText) {

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF7F7F")
                            .setDescription(
                                "<a:spider_cross:1514728338701287640> Please select a **text channel**."
                            )
                    ]
                });
            }

            const botMember =
                message.guild.members.me;

            if (
                !botMember ||
                !channel
                    .permissionsFor(botMember)
                    ?.has(PermissionFlagsBits.SendMessages)
            ) {

                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF7F7F")
                            .setDescription(
                                `<a:spider_cross:1514728338701287640> I don't have permission to send messages in ${channel}.`
                            )
                    ]
                });
            }

            await db.set(
                loggingKey,
                channel.id
            );

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#57F287")
                        .setTitle(
                            "<:shield:1514699900225323108> Antinuke Logging"
                        )
                        .setDescription(
                            `<a:Animated_Tick:1514714209085292564> Antinuke logs will now be sent to ${channel}.`
                        )
                ]
            });
        }

        // ==========================================
        // SHOW CURRENT CONFIGURATION
        // ,antinuke logging
        // ==========================================
        const channelId =
            await db.get(loggingKey);

        const currentChannel =
            channelId
                ? message.guild.channels.cache.get(channelId)
                : null;

        const embed = new EmbedBuilder()
            .setColor("#D3D3D3")
            .setTitle(
                "<:shield:1514699900225323108> Antinuke Logging"
            )
            .setDescription(
                currentChannel
                    ? `**Current Log Channel**

<:arrow:1514699753462566953> ${currentChannel}

Use \`,antinuke logging #channel\` to change it.
Use \`,antinuke logging disable\` to disable logging.`
                    : `**Current Log Channel**

<:arrow:1514699753462566953> Not configured.

Use \`,antinuke logging #channel\` to set a log channel.`
            )
            .setFooter({
                text: `Requested By ${message.author.username}`
            });

        const row = new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId("antinuke_logging_disable")
                    .setLabel("Disable")
                    .setStyle(ButtonStyle.Danger),

                new ButtonBuilder()
                    .setCustomId("antinuke_logging_delete")
                    .setEmoji("<:delete:1533526007112400956>")
                    .setStyle(ButtonStyle.Secondary)
            );

        const panel = await message.reply({
            embeds: [embed],
            components: [row]
        });

        // ==========================================
        // BUTTON COLLECTOR
        // ==========================================
        const collector =
            panel.createMessageComponentCollector({
                time: 300000
            });

        collector.on("collect", async interaction => {

            if (interaction.user.id !== message.author.id) {

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF7F7F")
                            .setDescription(
                                "<a:spider_cross:1514728338701287640> This menu isn't yours."
                            )
                    ],
                    ephemeral: true
                });
            }

            // DISABLE BUTTON
            if (
                interaction.customId ===
                "antinuke_logging_disable"
            ) {

                await db.delete(loggingKey);

                collector.stop();

                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF7F7F")
                            .setTitle(
                                "<:shield:1514699900225323108> Antinuke Logging"
                            )
                            .setDescription(
                                "<a:Animated_Tick:1514714209085292564> Antinuke logging has been **disabled**."
                            )
                    ],
                    components: []
                });
            }

            // DELETE PANEL
            if (
                interaction.customId ===
                "antinuke_logging_delete"
            ) {

                collector.stop();

                return panel.delete().catch(() => {});
            }
        });

        // ==========================================
        // COLLECTOR TIMEOUT
        // ==========================================
        collector.on("end", async () => {

            await panel.edit({
                components: []
            }).catch(() => {});

        });
    }
};
