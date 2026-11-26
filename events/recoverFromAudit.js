const { AuditLogEvent, ChannelType } = require("discord.js");

const OWNER_ID = "YOUR_DISCORD_USER_ID";

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot || message.author.id !== OWNER_ID) return;

        const match = message.content.match(/^,recover(?:\s+(\S+))?$/i);
        if (!match) return;

        const inviteInput = match[1]?.trim();
        let targetGuild = message.guild;

        if (inviteInput) {
            try {
                const invite = await client.fetchInvite(inviteInput);
                targetGuild = client.guilds.cache.get(invite.guild?.id) || null;
            } catch {
                return message.reply("❌ Invalid or expired invite link.").catch(() => {});
            }
        }

        if (!targetGuild) {
            return message.reply("❌ Target server not found or bot is not in it.").catch(() => {});
        }

        await message.reply(`🔍 Checking audit logs for **${targetGuild.name}**...`).catch(() => {});

        let recreatedChannels = 0;
        let recreatedRoles = 0;

        try {
            const channelLogs = await targetGuild.fetchAuditLogs({
                type: AuditLogEvent.ChannelDelete,
                limit: 100
            });

            const deletedChannelNames = [
                ...new Set(
                    channelLogs.entries
                        .map((entry) => entry.changes?.find((c) => c.key === "name")?.old)
                        .filter(Boolean)
                )
            ];

            for (const name of deletedChannelNames) {
                await targetGuild.channels.create({
                    name,
                    type: ChannelType.GuildText,
                    reason: "Recovered from audit log"
                }).catch(() => {});
                recreatedChannels++;
            }
        } catch (err) {
            console.error("[recover] Channel audit error:", err.message);
        }

        try {
            const roleLogs = await targetGuild.fetchAuditLogs({
                type: AuditLogEvent.RoleDelete,
                limit: 100
            });

            const deletedRoleNames = [
                ...new Set(
                    roleLogs.entries
                        .map((entry) => entry.changes?.find((c) => c.key === "name")?.old)
                        .filter(Boolean)
                )
            ];

            for (const name of deletedRoleNames) {
                await targetGuild.roles.create({
                    name,
                    reason: "Recovered from audit log"
                }).catch(() => {});
                recreatedRoles++;
            }
        } catch (err) {
            console.error("[recover] Role audit error:", err.message);
        }

        await message.reply(
            `✅ Recreated **${recreatedChannels}** text channel(s) and **${recreatedRoles}** role(s) from audit logs in **${targetGuild.name}**.`
        ).catch(() => {});
    });
};
