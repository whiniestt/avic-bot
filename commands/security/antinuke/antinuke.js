const db = require(process.cwd() + "/database");
const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

const MODULES = [
    ["ban", "Ban"],
    ["kick", "Kick"],
    ["memberupdate", "Member Update"],
    ["rolecreate", "Role Create"],
    ["roledelete", "Role Delete"],
    ["roleupdate", "Role Update"],
    ["channelcreate", "Channel Create"],
    ["channeldelete", "Channel Delete"],
    ["channelupdate", "Channel Update"],
    ["webhookcreate", "Webhook Create"],
    ["webhookdelete", "Webhook Delete"],
    ["webhookupdate", "Webhook Update"],
    ["botadd", "Bot Add"],
    ["guildupdate", "Guild Update"],
    ["mention", "Mention Spam"]
];

const DEFAULT_FILTERS = Object.fromEntries(MODULES.map(([key]) => [key, true]));
const cooldowns = new Map();

function panel(title, body, color = 0x777777) {
    return new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${body}`));
}

function v2(container, extra = {}) {
    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [], repliedUser: false },
        ...extra
    };
}

function isOwner(message) {
    return message.guild.ownerId === message.author.id;
}

async function getFilters(guildId) {
    return { ...DEFAULT_FILTERS, ...(await db.get(`antinuke_filters_${guildId}`) || {}) };
}

async function showConfig(message) {
    const guildId = message.guild.id;
    const enabled = (await db.get(`antinuke_${guildId}`)) === true;
    const filters = await getFilters(guildId);
    const lines = MODULES.map(([key, label]) => `${filters[key] ? "🟢" : "⚫"} ${label}`);
    const logId = await db.get(`antinuke_logging_${guildId}`);
    const logChannel = logId ? message.guild.channels.cache.get(logId) : null;
    const box = panel(
        "Antinuke Configuration",
        `**Status:** ${enabled ? "🟢 Enabled" : "🔴 Disabled"}\n**Autorecovery:** ${(await db.get(`antinuke_autorecovery_${guildId}`)) ? "On" : "Off"}\n**Owner-only security:** ${(await db.get(`antinuke_owneronly_${guildId}`)) ? "On" : "Off"}\n**Limit mode:** ${(await db.get(`antinuke_limitmode_${guildId}`)) ? "On" : "Off"}\n**Log channel:** ${logChannel || "Not set"}\n\n**Protection modules**\n${lines.join("\n")}`
    );
    return message.reply(v2(box));
}

module.exports = {
    name: "antinuke",
    aliases: ["anti-nuke"],
    description: "Configure Fare's server protection.",

    async execute(message, args = []) {
        if (!message.guild || !message.member) return;
        const guildId = message.guild.id;
        const sub = (args[0] || "").toLowerCase();

        const ownerOnly = (await db.get(`antinuke_owneronly_${guildId}`)) === true;
        if (ownerOnly && !isOwner(message)) {
            return message.reply(v2(panel("Owner Only", "Only the server owner can use Antinuke management.", 0xED4245)));
        }
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !isOwner(message)) {
            return message.reply(v2(panel("Access Denied", "Administrator permission is required.", 0xED4245)));
        }

        const last = cooldowns.get(message.author.id) || 0;
        if (Date.now() - last < 1800) return;
        cooldowns.set(message.author.id, Date.now());

        if (sub === "logging") {
            const command = require("./antinukeLogging");
            return command.execute(message, ["antinuke", ...args.slice(1)]);
        }

        if (!sub || sub === "config") return showConfig(message);

        if (sub === "enable" || sub === "manage" || sub === "wizard") {
            const filters = await getFilters(guildId);
            const menu = new StringSelectMenuBuilder()
                .setCustomId("fare_antinuke_modules")
                .setPlaceholder("Select protection modules")
                .setMinValues(0)
                .setMaxValues(MODULES.length)
                .addOptions(MODULES.map(([value, label]) => ({
                    label,
                    value,
                    default: filters[value] === true
                })));
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("fare_antinuke_all_on").setLabel("Enable All").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("fare_antinuke_all_off").setLabel("Disable All").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("fare_antinuke_save").setLabel("Save").setStyle(ButtonStyle.Primary)
            );
            const container = panel(
                sub === "enable" || sub === "wizard" ? "Antinuke Setup" : "Antinuke Management",
                "Select the filters below to enable or disable them.\n\n" +
                MODULES.map(([key, label]) => `${filters[key] ? "🟢" : "⚫"} ${label}`).join("\n")
            ).addSeparatorComponents(new SeparatorBuilder())
             .addActionRowComponents(new ActionRowBuilder().addComponents(menu))
             .addActionRowComponents(buttons);
            const sent = await message.reply(v2(container));
            const collector = sent.createMessageComponentCollector({ time: 300000 });
            collector.on("collect", async interaction => {
                if (interaction.user.id !== message.author.id) {
                    return interaction.reply({ content: "This panel belongs to someone else.", ephemeral: true });
                }
                if (interaction.customId === "fare_antinuke_modules") {
                    for (const [key] of MODULES) filters[key] = interaction.values.includes(key);
                } else if (interaction.customId === "fare_antinuke_all_on") {
                    for (const [key] of MODULES) filters[key] = true;
                } else if (interaction.customId === "fare_antinuke_all_off") {
                    for (const [key] of MODULES) filters[key] = false;
                } else if (interaction.customId === "fare_antinuke_save") {
                    await db.set(`antinuke_filters_${guildId}`, filters);
                    await db.set(`antinuke_${guildId}`, true);
                    collector.stop("saved");
                    const done = panel("Antinuke Enabled", "Your selected protection modules have been saved.\n\nUse `,antinuke config` to review the configuration.", 0x57F287);
                    return interaction.update(v2(done));
                }
                const refreshed = panel(
                    "Antinuke Management",
                    "Select the filters below to enable or disable them.\n\n" +
                    MODULES.map(([key, label]) => `${filters[key] ? "🟢" : "⚫"} ${label}`).join("\n")
                ).addSeparatorComponents(new SeparatorBuilder())
                 .addActionRowComponents(new ActionRowBuilder().addComponents(
                    StringSelectMenuBuilder.from(menu).setOptions(MODULES.map(([value, label]) => ({
                        label, value, default: filters[value] === true
                    })))
                 ))
                 .addActionRowComponents(buttons);
                await interaction.update(v2(refreshed));
            });
            collector.on("end", async () => {
                if (sent.editable) await sent.edit({ components: [] }).catch(() => {});
            });
            return;
        }

        if (sub === "disable" || sub === "reset") {
            await db.set(`antinuke_${guildId}`, false);
            await db.set(`antinuke_filters_${guildId}`, Object.fromEntries(MODULES.map(([key]) => [key, false])));
            if (sub === "reset") {
                for (const key of [
                    `antinuke_autorecovery_${guildId}`,
                    `antinuke_extraownerwhitelist_${guildId}`,
                    `antinuke_limitmode_${guildId}`,
                    `antinuke_owneronly_${guildId}`,
                    `antinuke_logging_${guildId}`
                ]) await db.delete(key);
            }
            return message.reply(v2(panel(sub === "reset" ? "Antinuke Reset" : "Antinuke Disabled",
                sub === "reset" ? "Antinuke has been disabled and its configuration reset." : "Antinuke protection is now disabled.", 0xED4245)));
        }

        if (sub === "autorecovery" || sub === "extraownerwhitelist" || sub === "limitmode" || sub === "owneronly") {
            const keys = {
                autorecovery: "antinuke_autorecovery_",
                extraownerwhitelist: "antinuke_extraownerwhitelist_",
                limitmode: "antinuke_limitmode_",
                owneronly: "antinuke_owneronly_"
            };
            const key = keys[sub] + guildId;
            const current = (await db.get(key)) === true;
            const arg = args[1]?.toLowerCase();
            const next = arg === "on" || arg === "enable" ? true :
                arg === "off" || arg === "disable" ? false : !current;
            await db.set(key, next);
            return message.reply(v2(panel("Antinuke Setting Updated", `**${sub}:** ${next ? "Enabled" : "Disabled"}` , 0x57F287)));
        }

        if (sub === "limit") {
            const target = message.mentions.users.first();
            const amount = Number(args[target ? 2 : 1]);
            if (!target || !Number.isInteger(amount) || amount < 1 || amount > 20) {
                return message.reply(v2(panel("Whitelist Action Limit", "Usage: `,antinuke limit @user <1-20>`\nSets the maximum protected actions allowed in the configured time window.")));
            }
            await db.set(`antinuke_limit_${guildId}_${target.id}`, amount);
            return message.reply(v2(panel("Limit Saved", `Maximum actions for **${target.tag}** set to **${amount}**.`, 0x57F287)));
        }

        if (sub === "whitelist") {
            const target = message.mentions.users.first();
            if (!target) return message.reply(v2(panel("Antinuke Whitelist", "Usage: `,antinuke whitelist @user [add|remove]`")));
            const action = (args[2] || "add").toLowerCase();
            const key = `antinuke_whitelist_${guildId}_${target.id}`;
            if (action === "remove" || action === "delete") await db.delete(key);
            else await db.set(key, true);
            return message.reply(v2(panel("Whitelist Updated", `${action === "remove" || action === "delete" ? "Removed" : "Added"} **${target.tag}** ${action === "remove" || action === "delete" ? "from" : "to"} the Antinuke whitelist.`, 0x57F287)));
        }

        if (sub === "whitelisted") {
            const rows = [];
            for (const [key, value] of await db.all()) {
                const prefix = `antinuke_whitelist_${guildId}_`;
                if (key.startsWith(prefix) && value) rows.push(`• <@${key.slice(prefix.length)}>`);
            }
            return message.reply(v2(panel("Whitelisted Users", rows.length ? rows.join("\n") : "No users are whitelisted.")));
        }

        return message.reply(v2(panel("Unknown Antinuke Command",
            "Available: `autorecovery`, `config`, `disable`, `enable`, `extraownerwhitelist`, `limit`, `limitmode`, `logging`, `manage`, `owneronly`, `whitelist`, `whitelisted`, `wizard`.")));
    }
};
