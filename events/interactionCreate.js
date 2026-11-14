const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");
const { EmbedBuilder } = require("discord.js");
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

const profileDB = require("../database/profile");

module.exports = (client) => {

    client.on("interactionCreate", async (interaction) => {

        // =========================
        // PROFILE EDIT BUTTONS
        // =========================

        if (interaction.isButton()) {

            // =========================
// FARE DM OFF BUTTON
// =========================

if (interaction.customId === "dm_off") {

    await db.set(`dmupdates.${interaction.user.id}`, false);

    return interaction.reply({
        content: "🔕 Fare DMs have been disabled.",
        ephemeral: true
    });
}
            
            // =========================
// GIVEAWAY JOIN
// =========================

if (interaction.customId === "giveaway_join") {

    const giveaway = await db.get(`giveaway_${interaction.message.id}`);

    if (!giveaway) {
        return interaction.reply({
            content: "❌ Giveaway not found.",
            ephemeral: true
        });
    }

    if (giveaway.ended) {
        return interaction.reply({
            content: "❌ This giveaway has already ended.",
            ephemeral: true
        });
    }

    if (giveaway.entries.includes(interaction.user.id)) {
        return interaction.reply({
            content: "❌ You have already joined this giveaway.",
            ephemeral: true
        });
    }

    giveaway.entries.push(interaction.user.id);

    await db.set(`giveaway_${interaction.message.id}`, giveaway);

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);

    embed.setDescription(
`## 🎁 ${giveaway.prize}

> 👑 **Host:** <@${giveaway.hostId}>
> 👥 **Winners:** **${giveaway.winners}**
> 🎟️ **Entries:** **${giveaway.entries.length}**
> ⏰ **Ends:** <t:${Math.floor(giveaway.endTime / 1000)}:R>

Click the **🎉 Join Giveaway** button below to enter.

Good luck everyone! 🍀`
    );

    await interaction.update({
        embeds: [embed]
    });
}

            // ABOUT MODAL
            if (interaction.customId === "about_edit") {

                const modal = new ModalBuilder()
                    .setCustomId("profile_about")
                    .setTitle("Edit About");

                const bio = new TextInputBuilder()
                    .setCustomId("bio")
                    .setLabel("Biography")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(250);

                const birthday = new TextInputBuilder()
                    .setCustomId("birthday")
                    .setLabel("Birthday")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const pronouns = new TextInputBuilder()
                    .setCustomId("pronouns")
                    .setLabel("Pronouns")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const theme = new TextInputBuilder()
                    .setCustomId("theme")
                    .setLabel("Theme Colour (Hex)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const banner = new TextInputBuilder()
                    .setCustomId("banner")
                    .setLabel("Banner URL")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(bio),
                    new ActionRowBuilder().addComponents(birthday),
                    new ActionRowBuilder().addComponents(pronouns),
                    new ActionRowBuilder().addComponents(theme),
                    new ActionRowBuilder().addComponents(banner)
                );

                return interaction.showModal(modal);
            }

        // SOCIAL MODAL
            if (interaction.customId === "social_edit") {

                const modal = new ModalBuilder()
                    .setCustomId("profile_social")
                    .setTitle("Edit Socials");

                const instagram = new TextInputBuilder()
                    .setCustomId("instagram")
                    .setLabel("Instagram")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const youtube = new TextInputBuilder()
                    .setCustomId("youtube")
                    .setLabel("YouTube")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const twitter = new TextInputBuilder()
                    .setCustomId("twitter")
                    .setLabel("Twitter / X")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const twitch = new TextInputBuilder()
                    .setCustomId("twitch")
                    .setLabel("Twitch")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const website = new TextInputBuilder()
                    .setCustomId("website")
                    .setLabel("Website")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(instagram),
                    new ActionRowBuilder().addComponents(youtube),
                    new ActionRowBuilder().addComponents(twitter),
                    new ActionRowBuilder().addComponents(twitch),
                    new ActionRowBuilder().addComponents(website)
                );

                return interaction.showModal(modal);
            }

        }

        // =========================
        // MODAL SUBMITS
        // =========================

        if (!interaction.isModalSubmit()) return;

              if (interaction.customId === "profile_about") {

            await profileDB.set(interaction.user.id, {
                bio: interaction.fields.getTextInputValue("bio"),
                birthday: interaction.fields.getTextInputValue("birthday"),
                pronouns: interaction.fields.getTextInputValue("pronouns"),
                theme: interaction.fields.getTextInputValue("theme"),
                banner: interaction.fields.getTextInputValue("banner")
            });

            return interaction.reply({
                content: "✅ Your **About** profile has been updated!",
                ephemeral: true
            });
        }

        if (interaction.customId === "profile_social") {

            await profileDB.set(interaction.user.id, {
                instagram: interaction.fields.getTextInputValue("instagram"),
                youtube: interaction.fields.getTextInputValue("youtube"),
                twitter: interaction.fields.getTextInputValue("twitter"),
                twitch: interaction.fields.getTextInputValue("twitch"),
                website: interaction.fields.getTextInputValue("website")
            });

            return interaction.reply({
                content: "✅ Your **Socials** have been updated!",
                ephemeral: true
            });
        }

    });

};
