const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const profileDB = require("../../database/profile");

module.exports = {
    name: "profile",
    aliases: ["pf"],

    async execute(message, args) {

        const member =
            message.mentions.members.first() ||
            message.guild.members.cache.get(args[0]) ||
            message.member;

        const user = member.user;

        const profile = await profileDB.get(user.id);
        const stats = await db.get(`stats.${user.id}`) || {};

        const avatar = user.displayAvatarURL({
            dynamic: true,
            size: 4096
        });

        const aboutEmbed = new EmbedBuilder()
            .setColor(profile.theme || "#D3D3D3")
            .setAuthor({
                name: `${user.username}'s Profile`,
                iconURL: avatar
            })
            .setThumbnail(avatar)
            .setDescription(
`### <:member2:1514699734038876343> About

> **Bio:** ${profile.bio || "*Nothing here yet.*"}
> **Birthday:** ${profile.birthday || "Not set"}
> **Pronouns:** ${profile.pronouns || "Not set"}

### <:hat:1514699954264998041> Account

> **Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>
> **Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>
> **Top Role:** ${member.roles.highest}

-# Requested by ${message.author}`
            );

        const row = new ActionRowBuilder().addComponents(

            new ButtonBuilder()
                .setCustomId("about")
                .setLabel("About")
                .setEmoji("<:member2:1514699734038876343>")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("social")
                .setLabel("Social")
                .setEmoji("<:link:1514699706788221120>")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId("stats")
                .setLabel("Stats")
                .setEmoji("<:info:1514699288674828310>")
                .setStyle(ButtonStyle.Secondary)

        );

        const msg = await message.reply({
            embeds: [aboutEmbed],
            components: [row]
        });

        const collector = msg.createMessageComponentCollector({
            time: 300000
        });

          collector.on("collect", async interaction => {

            if (interaction.user.id !== message.author.id) {
                return interaction.reply({
                    content: "This menu isn't yours.",
                    ephemeral: true
                });
            }

            const data = await profileDB.get(user.id);

            if (interaction.customId === "about") {

                return interaction.update({
                    embeds: [aboutEmbed]
                });

            }

            if (interaction.customId === "social") {

                const socialEmbed = new EmbedBuilder()
                    .setColor(data.theme || "#D3D3D3")
                    .setAuthor({
                        name: `${user.username}'s Profile`,
                        iconURL: avatar
                    })
                    .setThumbnail(avatar)
                    .setDescription(
`### <:link:1514699706788221120> Social

> **Website:** ${data.website || "Not connected"}
> **Instagram:** ${data.instagram || "Not connected"}
> **YouTube:** ${data.youtube || "Not connected"}
> **Twitter/X:** ${data.twitter || "Not connected"}
> **Twitch:** ${data.twitch || "Not connected"}

-# Requested by ${message.author}`
                    );

                return interaction.update({
                    embeds: [socialEmbed]
                });

            }

            if (interaction.customId === "stats") {

                const statsEmbed = new EmbedBuilder()
                    .setColor(data.theme || "#D3D3D3")
                    .setAuthor({
                        name: `${user.username}'s Profile`,
                        iconURL: avatar
                    })
                    .setThumbnail(avatar)
                    .setDescription(
`### <:info:1514699288674828310> Stats

> **Level:** ${Math.floor((stats.xp || 0) / 100)}
> **XP:** ${stats.xp || 0}
> **Messages:** ${stats.messages || 0}
> **Voice Time:** Coming Soon

-# Requested by ${message.author}`
)

                return interaction.update({
                    embeds: [statsEmbed]
                });

            }

        });

      collector.on("end", async () => {

            try {

                const disabledRow = new ActionRowBuilder().addComponents(

                    ButtonBuilder.from(row.components[0]).setDisabled(true),

                    ButtonBuilder.from(row.components[1]).setDisabled(true),

                    ButtonBuilder.from(row.components[2]).setDisabled(true)

                );

                await msg.edit({
                    components: [disabledRow]
                });

            } catch {}

        });

    }

};
