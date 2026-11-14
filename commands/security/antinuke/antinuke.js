const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");

const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    PermissionFlagsBits
} = require("discord.js");

const cooldown = new Map();

module.exports = {
    name: "antinuke",
    description: "Configure and manage server antinuke protection settings.",

    async execute(message, args) {

        // ==========================================
        // 1. SECURITY & PERMISSIONS GUARD
        // ==========================================
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription(
                            "<a:spider_cross:1514728338701287640> **Access Denied:** You need **Administrator** permissions to manage Antinuke configurations."
                        )
                ]
            });
        }

        // ==========================================
        // 2. COOLDOWN SYSTEM
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
                                `<:WarningIcon:1514708751385497721> You are under cooldown.\n\n<:arrow:1514699753462566953> Cooldown • \`${timeLeft}s\``
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

        const sub = args[0]?.toLowerCase();

        // ==========================================
        // 3. HELP MENU - PAGINATED
        // ==========================================
        if (!sub) {

            const pages = [
                {
                    title: "<:shield:1514699900225323108> Antinuke System",
                    description:
`<a:MekoLoading:1514728537452708022> **Available Antinuke Commands [13]**

\`,antinuke enable\`
> Enable and configure antinuke protection.

\`,antinuke disable\`
> Disable server protection.

\`,antinuke autorecovery\`
> Manage server autorecovery settings.

\`,antinuke betrayalguard\`
> Enable or disable betrayal guard.

\`,antinuke limit\`
> Set security limits.

\`,antinuke logging\`
> Set antinuke log channel.

\`,antinuke manage\`
> Manage all settings.`
                },

                {
                    title: "<:shield:1514699900225323108> Antinuke System",
                    description:
`<a:MekoLoading:1514728537452708022> **Available Antinuke Commands [13]**

\`,antinuke reset\`
> Reset all data.

\`,antinuke whitelist\`
> Manage whitelist users.

\`,antinuke trustlimit\`
> Set trusted limits.

\`,antinuke wallon / walloff\`
> Toggle wall protection.

\`,antinuke wizard\`
> One-click setup.

\`,antinuke zplus\`
> Advanced protection system.`
                }
            ];

            let page = 0;

            const getEmbed = () => {
                return new EmbedBuilder()
                    .setColor("#D3D3D3")
                    .setTitle(pages[page].title)
                    .setDescription(pages[page].description)
                    .setFooter({
                        text: `Page ${page + 1}/${pages.length} | Requested By ${message.author.username}`
                    });
            };

            const row = new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId("first")
                        .setEmoji("<:backward:1533527358500503703>")
                        .setStyle(ButtonStyle.Secondary),

                    new ButtonBuilder()
                        .setCustomId("previous")
                        .setEmoji("<:previous:1533532115311005817>")
                        .setStyle(ButtonStyle.Secondary),

                    new ButtonBuilder()
                        .setCustomId("delete")
                        .setEmoji("<:delete:1533526007112400956>")
                        .setStyle(ButtonStyle.Danger),

                    new ButtonBuilder()
                        .setCustomId("next")
                        .setEmoji("<:next:1533532139415408881>")
                        .setStyle(ButtonStyle.Secondary),

                    new ButtonBuilder()
                        .setCustomId("last")
                        .setEmoji("<:forward:1533527377727066214>")
                        .setStyle(ButtonStyle.Secondary)
                );

            const msg = await message.reply({
                embeds: [getEmbed()],
                components: [row]
            });

            const collector = msg.createMessageComponentCollector({
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

                // DELETE
                if (interaction.customId === "delete") {
                    collector.stop();
                    return msg.delete().catch(() => {});
                }

                // FIRST PAGE
                if (interaction.customId === "first") {
                    page = 0;
                }

                // PREVIOUS PAGE
                if (interaction.customId === "previous") {
                    page = Math.max(0, page - 1);
                }

                // NEXT PAGE
                if (interaction.customId === "next") {
                    page = Math.min(pages.length - 1, page + 1);
                }

                // LAST PAGE
                if (interaction.customId === "last") {
                    page = pages.length - 1;
                }

                await interaction.update({
                    embeds: [getEmbed()],
                    components: [row]
                });
            });

            collector.on("end", async () => {
                await msg.edit({
                    components: []
                }).catch(() => {});
            });

            return;
        }

        // ==========================================
        // 4. SUBCOMMANDS: ENABLE & MANAGE
        // ==========================================
        if (sub === "enable" || sub === "manage") {

            const enabled = await db.get(
                `antinuke_${message.guild.id}`
            );

            if (sub === "enable" && enabled === true) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FFCC66")
                            .setDescription(
                                `<:WarningIcon:1514708751385497721> Antinuke is already enabled.\n\nUse \`,antinuke manage\` to edit settings.`
                            )
                    ]
                });
            }

            if (sub === "manage" && enabled !== true) {
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

            const currentFilters =
                (await db.get(
                    `antinuke_filters_${message.guild.id}`
                )) || {
                    ban: true,
                    kick: true,
                    botadd: true,
                    channeldelete: true,
                    roledelete: true,
                    guildupdate: true,
                    webhook: true,
                    mention: true
                };

            const getDisplayDescription = (f) =>
`Configure your server protection before enabling Antinuke.

${f.ban ? "<:on:1520340385451347968>" : "<:off:1520340423829098597>"} Ban
${f.kick ? "<:on:1520340385451347968>" : "<:off:1520340423829098597>"} Kick
${f.botadd ? "<:on:1520340385451347968>" : "<:off:1520340423829098597>"} Bot Add
${f.channeldelete ? "<:on:1520340385451347968>" : "<:off:1520340423829098597>"} Channel Delete
${f.roledelete ? "<:on:1520340385451347968>" : "<:off:1520340423829098597>"} Role Delete
${f.guildupdate ? "<:on:1520340385451347968>" : "<:off:1520340423829098597>"} Guild Update
${f.webhook ? "<:on:1520340385451347968>" : "<:off:1520340423829098597>"} Webhook
${f.mention ? "<:on:1520340385451347968>" : "<:off:1520340423829098597>"} Mention Spam`;

            const embed = new EmbedBuilder()
                .setColor("#D3D3D3")
                .setTitle(
                    sub === "enable"
                        ? "<:shield:1514699900225323108> Antinuke Setup"
                        : "<:shield:1514699900225323108> Antinuke Manage Panel"
                )
                .setDescription(
                    getDisplayDescription(currentFilters)
                );

            const menu = new StringSelectMenuBuilder()
                .setCustomId("antinuke_menu")
                .setPlaceholder("Toggle protections")
                .addOptions([
                    {
                        label: "Ban",
                        value: "ban"
                    },
                    {
                        label: "Kick",
                        value: "kick"
                    },
                    {
                        label: "Bot Add",
                        value: "botadd"
                    },
                    {
                        label: "Channel Delete",
                        value: "channeldelete"
                    },
                    {
                        label: "Role Delete",
                        value: "roledelete"
                    },
                    {
                        label: "Guild Update",
                        value: "guildupdate"
                    },
                    {
                        label: "Webhook",
                        value: "webhook"
                    },
                    {
                        label: "Mention Spam",
                        value: "mention"
                    }
                ]);

            const buttons = new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId("save")
                        .setLabel("Save")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId("cancel")
                        .setLabel("Cancel")
                        .setStyle(ButtonStyle.Danger)
                );

            const rows = [
                new ActionRowBuilder().addComponents(menu),
                buttons
            ];

            const panel = await message.reply({
                embeds: [embed],
                components: rows
            });

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

                if (interaction.isStringSelectMenu()) {

                    const value = interaction.values[0];

                    currentFilters[value] =
                        !currentFilters[value];

                    embed.setDescription(
                        getDisplayDescription(currentFilters)
                    );

                    return interaction.update({
                        embeds: [embed],
                        components: rows
                    });
                }

                if (interaction.isButton()) {

                    collector.stop();

                    if (interaction.customId === "cancel") {

                        return interaction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#D3D3D3")
                                    .setDescription(
                                        "<a:spider_cross:1514728338701287640> Configuration updates cancelled."
                                    )
                            ],
                            components: []
                        });
                    }

                    if (interaction.customId === "save") {

                        await db.set(
                            `antinuke_${message.guild.id}`,
                            true
                        );

                        await db.set(
                            `antinuke_filters_${message.guild.id}`,
                            currentFilters
                        );

                        const finalTitle =
                            sub === "enable"
                                ? "<:shield:1514705361935012081> Antinuke System Activated"
                                : "<:shield:1514699900225323108> Antinuke Settings Saved";

                        return interaction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#57F287")
                                    .setTitle(finalTitle)
                                    .setDescription(
                                        `<a:Animated_Tick:1514714209085292564> Settings saved successfully.\n\n<:arrow:1514699753462566953> Your server is now fully secured.`
                                    )
                            ],
                            components: []
                        });
                    }
                }
            });

            return;
        }

        // ==========================================
        // 5. SUBCOMMAND: DISABLE
        // ==========================================
        if (sub === "disable") {

            const enabled = await db.get(
                `antinuke_${message.guild.id}`
            );

            if (!enabled || enabled === false) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF7F7F")
                            .setDescription(
                                "<a:spider_cross:1514728338701287640> Antinuke system is already **disabled** for this server."
                            )
                    ]
                });
            }

            const confirmEmbed = new EmbedBuilder()
                .setColor("#FFCC66")
                .setDescription(
`<:WarningIcon:1514708751385497721> Are you sure you want to **DISABLE Antinuke** in this server?

<:arrow:1514699753462566953> This will turn off antinuke for this server.`
                );

            const confirmRow = new ActionRowBuilder()
                .addComponents(

                    new ButtonBuilder()
                        .setCustomId("disable_yes")
                        .setLabel("Yes")
                        .setEmoji("1514714209085292564")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId("disable_no")
                        .setLabel("No")
                        .setEmoji("1514728338701287640")
                        .setStyle(ButtonStyle.Danger)
                );

            const panel = await message.reply({
                embeds: [confirmEmbed],
                components: [confirmRow]
            });

            const collector =
                panel.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 60000
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

                collector.stop();

                if (interaction.customId === "disable_yes") {

                    await db.set(
                        `antinuke_${message.guild.id}`,
                        false
                    );

                    await db.set(
                        `antinuke_filters_${message.guild.id}`,
                        {
                            ban: false,
                            kick: false,
                            botadd: false,
                            channeldelete: false,
                            roledelete: false,
                            guildupdate: false,
                            webhook: false,
                            mention: false
                        }
                    );

                    return interaction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#FF7F7F")
                                .setTitle(
                                    "<:shield:1514699900225323108> Antinuke Disabled"
                                )
                                .setDescription(
                                    "<a:spider_cross:1514728338701287640> Antinuke has been **disabled**."
                                )
                        ],
                        components: []
                    });
                }

                if (interaction.customId === "disable_no") {

                    return interaction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#57F287")
                                .setDescription(
                                    "<a:Animated_Tick:1514714209085292564> Action aborted. Antinuke protection remains active."
                                )
                        ],
                        components: []
                    });
                }
            });

            collector.on("end", async (collected, reason) => {

                if (reason === "time") {

                    await panel.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#D3D3D3")
                                .setDescription(
                                    "<a:spider_cross:1514728338701287640> Disable confirmation timed out."
                                )
                        ],
                        components: []
                    }).catch(() => {});
                }
            });
        }
    }
};
