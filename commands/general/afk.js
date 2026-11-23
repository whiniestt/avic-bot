const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require("discord.js");
const db = require(process.cwd() + "/database");

const GREY = 0xD3D3D3;
const V2 = MessageFlags.IsComponentsV2;
const NO_MENTIONS = { parse: [], repliedUser: false };

function afkContainer(message, content, color = GREY, row = null) {
    const avatar = message.author.displayAvatarURL({ extension: "png", size: 128 });
    const container = new ContainerBuilder()
        .setAccentColor(color)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
        );

    if (row) container.addActionRowComponents(row);
    return container;
}

function panelPayload(message, content, color = GREY, row = null) {
    return {
        components: [afkContainer(message, content, color, row)],
        flags: V2,
        allowedMentions: NO_MENTIONS
    };
}

function deleteAfter15Seconds(message) {
    setTimeout(() => message.delete().catch(() => {}), 15000);
}

module.exports = {
    name: "afk",

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(panelPayload(message, "<:WarningIcon:1514708751385497721> Use this command in a server.", 0xFF7F7F));
        }

        const reason = args.length ? args.join(" ") : "~ Busy </>";
        const already =
            await db.get(`afk_${message.author.id}`) ||
            await db.get(`afk_${message.guild.id}_${message.author.id}`);

        if (already) {
            return message.reply(panelPayload(
                message,
                "<:WarningIcon:1514708751385497721> You are already AFK.",
                0xFFCC66
            ));
        }

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

        const panel = afkContainer(
            message,
            "### <:timerr:1514699712681218094> AFK Panel\nChoose your AFK mode below.",
            GREY,
            row
        );
        const msg = await message.reply({
            components: [panel],
            flags: V2,
            allowedMentions: NO_MENTIONS
        });

        let handled = false;
        const collector = msg.createMessageComponentCollector({ time: 10000 });

        collector.on("collect", async interaction => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({
                    components: [afkContainer(
                        message,
                        "<:WarningIcon:1514708751385497721> This panel isn't yours.",
                        0xFF7F7F
                    )],
                    flags: V2 | MessageFlags.Ephemeral,
                    allowedMentions: NO_MENTIONS
                });
            }

            if (interaction.customId === "afk_close") {
                handled = true;
                collector.stop("handled");
                await interaction.update(panelPayload(
                    message,
                    "### AFK Panel Closed\nThis panel is closed.",
                    GREY
                ));
                return deleteAfter15Seconds(msg);
            }

            if (interaction.customId === "afk_global") {
                await db.set(`afk_${message.author.id}`, {
                    reason,
                    since: Date.now(),
                    type: "global",
                    mentions: 0
                });

                handled = true;
                collector.stop("handled");
                await interaction.update(panelPayload(
                    message,
                    `<:Tick:1514714190500335677> **Global AFK set**\n\n<:arrow:1514699753462566953> Reason • ${reason}`,
                    0x57F287
                ));
                return deleteAfter15Seconds(msg);
            }

            if (interaction.customId === "afk_server") {
                await db.set(`afk_${message.guild.id}_${message.author.id}`, {
                    reason,
                    since: Date.now(),
                    type: "server",
                    mentions: 0
                });

                handled = true;
                collector.stop("handled");
                await interaction.update(panelPayload(
                    message,
                    `<:Tick:1514714190500335677> **Server AFK set**\n\n<:arrow:1514699753462566953> Reason • ${reason}`,
                    GREY
                ));
                return deleteAfter15Seconds(msg);
            }
        });

        collector.on("end", () => {
            if (handled) return;
            handled = true;
            msg.edit(panelPayload(
                message,
                "### AFK Panel Closed\nThe buttons expired, so this panel is closed.",
                GREY
            ))
                .then(() => deleteAfter15Seconds(msg))
                .catch(() => {});
        });
    }
};
