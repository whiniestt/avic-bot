// Replace with your Discord User ID
const OWNER_ID = "1530872106399567941";

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (message.author.id !== OWNER_ID) return;

        // Matches: ,get remove <server-link> (or !get remove <server-link>)
        const match = message.content.match(/^[!,]get\s+remove\s+(\S+)/i);
        if (!match) return;

        const inviteInput = match[1].trim();

        let targetGuild;
        try {
            const invite = await client.fetchInvite(inviteInput);
            targetGuild = client.guilds.cache.get(invite.guild?.id);
        } catch (err) {
            return message.reply("❌ Invalid or expired server invite link.").catch(() => {});
        }

        if (!targetGuild) {
            return message.reply("❌ The bot is not in the server from that link.").catch(() => {});
        }

        const guildName = targetGuild.name;

        try {
            await targetGuild.leave();
            await message.reply(`✅ Bot has left **${guildName}**.`).catch(() => {});
        } catch (err) {
            await message.reply(`❌ Failed to leave **${guildName}**: ${err.message}`).catch(() => {});
        }
    });
};
