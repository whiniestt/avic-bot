const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const { QuickDB } = require("quick.db");

const db = require(process.cwd() + "/database");

const OWNER_ID = "1530872106399567941";

module.exports = {
    name: "dmupdates",
    aliases: ["dm", "notifications"],

    async execute(message, args) {

        // User enables/disables DM announcements
        if (args[0] === "on") {

            await db.set(`dmupdates.${message.author.id}`, true);

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setDescription(
                            "✅ You have **enabled Fare DMs**.\n\n" +
                            "You will receive Fare announcements and collaboration updates."
                        )
                ]
            });
        }

        if (args[0] === "off") {

            await db.set(`dmupdates.${message.author.id}`, false);

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setDescription(
                            "🔕 You have **disabled Fare DMs**.\n\n" +
                            "You will no longer receive Fare announcements."
                        )
                ]
            });
        }

        // Owner-only announcement
        if (args[0] === "send") {

            if (message.author.id !== OWNER_ID) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#ED4245")
                            .setDescription("❌ You don't have permission to use this.")
                    ]
                });
            }

            const embed = new EmbedBuilder()
                .setColor("#D3D3D3")
                .setTitle("Fare × Server Collaboration")
                .setDescription(
                    "Fare has collaborated with a new server! 🖤\n\n" +
                    "If you'd like to support us, we'd really appreciate you joining their community.\n\n" +
                    "**Thank you for supporting Fare.**"
                )
                .setFooter({
                    text: "Fare • DM Notifications"
                });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel("Join Server")
                        .setStyle(ButtonStyle.Link)
                        .setURL("https://discord.gg/6G6TeNB739"),

                    new ButtonBuilder()
                        .setCustomId("dm_off")
                        .setLabel("Turn Off DMs")
                        .setStyle(ButtonStyle.Danger)
                );

            const users = await db.all();

            let sent = 0;
            let failed = 0;

            for (const entry of users) {

                if (!entry.id.startsWith("dmupdates.")) continue;
                if (entry.value !== true) continue;

                const userId = entry.id.replace("dmupdates.", "");

                try {

                    const user = await message.client.users.fetch(userId);

                    await user.send({
                        embeds: [embed],
                        components: [row]
                    });

                    sent++;

                    // Small delay between DMs
                    await new Promise(resolve =>
                        setTimeout(resolve, 1500)
                    );

                } catch {
                    failed++;
                }
            }

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setTitle("DM Announcement Sent")
                        .setDescription(
                            `✅ Sent: **${sent}**\n` +
                            `❌ Failed: **${failed}**`
                        )
                ]
            });
        }

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("#D3D3D3")
                    .setTitle("Fare DM Notifications")
                    .setDescription(
                        "Use the commands below:\n\n" +
                        "`,dmupdates on` — Enable Fare DMs\n" +
                        "`,dmupdates off` — Disable Fare DMs"
                    )
            ]
        });
    }
};
