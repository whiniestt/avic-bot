const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");
const { AuditLogEvent } = require("discord.js");

module.exports = (client) => {

    // ==========================================
    // PREMIUM HELPER: VERIFY IF PROTECTION IS ACTIVE
    // ==========================================
    async function shouldAction(guild, filterType, executorId) {
        // 1. Is global antinuke on?
        const isEnabled = await db.get(`antinuke_${guild.id}`);
        if (!isEnabled) return false;

        // 2. Is this specific filter active?
        const filters = await db.get(`antinuke_filters_${guild.id}`);
        if (!filters || filters[filterType] !== true) return false;

        // 3. Bypass if the executor is the Server Owner or the Bot itself
        if (executorId === guild.ownerId || executorId === client.user.id) return false;

        // 4. Bypass if the user is custom whitelisted
        const isWhitelisted = await db.get(`antinuke_whitelist_${guild.id}_${executorId}`);
        if (isWhitelisted) return false;

        return true;
    }

    // ==========================================
    // PREMIUM HELPER: PUNISH THE ROGUE ADMIN
    // ==========================================
    async function punishExecutor(guild, executorId, reason) {
        const member = await guild.members.fetch(executorId).catch(() => null);
        if (!member) return;

        // Attempt to ban the nuker. If hierarchy blocks it, strip all their roles instead.
        await member.ban({ reason: `Antinuke: ${reason}` }).catch(async () => {
            await member.roles.set([], `Antinuke: Failed to ban, stripped all roles instead.`).catch(() => {});
        });
    }

    // ==========================================
    // 1. WATCHING BAN LOGS (guildBanAdd)
    // ==========================================
    client.on("guildBanAdd", async (ban) => {
        const guild = ban.guild;

        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        const { executor, target } = logEntry;

        if (!(await shouldAction(guild, "ban", executor.id))) return;

        // REVERSE THE DAMAGE: Unban the victim
        await guild.members.unban(target.id, "Antinuke: Reversing illegal ban").catch(() => {});

        // PUNISH NUKER
        await punishExecutor(guild, executor.id, "Rogue Admin Mass Banning");
    });

    // ==========================================
    // 2. WATCHING KICK LOGS (guildMemberRemove)
    // ==========================================
    client.on("guildMemberRemove", async (member) => {
        const guild = member.guild;

        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        const { executor, target } = logEntry;

        // Ensure the kick entry belongs to this user who left
        if (target.id !== member.id) return;

        if (!(await shouldAction(guild, "kick", executor.id))) return;

        // PUNISH NUKER
        await punishExecutor(guild, executor.id, "Rogue Admin Mass Kicking");
    });

    // ==========================================
    // 3. WATCHING CHANNEL DELETIONS (channelDelete)
    // ==========================================
    client.on("channelDelete", async (channel) => {
        const guild = channel.guild;
        if (!guild) return;

        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        const { executor } = logEntry;

        if (!(await shouldAction(guild, "channeldelete", executor.id))) return;

        // REVERSE THE DAMAGE: Re-create the deleted channel
        await channel.clone({ reason: "Antinuke: Restoring deleted channel" }).catch(() => {});

        // PUNISH NUKER
        await punishExecutor(guild, executor.id, "Rogue Admin Deleting Channels");
    });

    // ==========================================
    // 4. WATCHING ROLE DELETIONS (roleDelete)
    // ==========================================
    client.on("roleDelete", async (role) => {
        const guild = role.guild;

        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        const { executor } = logEntry;

        if (!(await shouldAction(guild, "roledelete", executor.id))) return;

        // REVERSE THE DAMAGE: Re-create the deleted role with original options
        await guild.roles.create({
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            permissions: role.permissions,
            mentionable: role.mentionable,
            reason: "Antinuke: Restoring deleted role"
        }).catch(() => {});

        // PUNISH NUKER
        await punishExecutor(guild, executor.id, "Rogue Admin Deleting Roles");
    });

    // ==========================================
    // 5. ANTI BOT ADD (guildMemberAdd)
    // ==========================================
    client.on("guildMemberAdd", async (member) => {
        if (!member.user.bot) return; // Only trigger if a bot joined
        const guild = member.guild;

        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        const { executor } = logEntry;

        if (!(await shouldAction(guild, "botadd", executor.id))) return;

        // REVERSE THE DAMAGE: Kick the malicious unauthorized bot instantly
        await member.kick("Antinuke: Unauthorized Bot Integration").catch(() => {});

        // PUNISH THE ADMIN WHO INVITED IT
        await punishExecutor(guild, executor.id, "Rogue Admin Adding Unauthorized Bots");
    });

    // ==========================================
    // 6. ANTI WEBHOOK MALICIOUS ACTIONS (webhooksUpdate)
    // ==========================================
    client.on("webhooksUpdate", async (channel) => {
        const guild = channel.guild;
        if (!guild) return;

        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        const { executor, target } = logEntry;

        if (!(await shouldAction(guild, "webhook", executor.id))) return;

        // REVERSE THE DAMAGE: Delete the newly spawned rogue webhook
        if (target) {
            const webhooks = await channel.fetchWebhooks().catch(() => null);
            const targetWebhook = webhooks?.find(wh => wh.id === target.id);
            if (targetWebhook) await targetWebhook.delete("Antinuke: Removing rogue webhook").catch(() => {});
        }

        // PUNISH NUKER
        await punishExecutor(guild, executor.id, "Rogue Admin Creating Webhooks");
    });

    // ==========================================
    // 7. ANTI GUILD PROFILE CHANGES (guildUpdate)
    // ==========================================
    client.on("guildUpdate", async (oldGuild, newGuild) => {
        const guild = newGuild;

        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate }).catch(() => null);
        if (!fetchedLogs) return;
        const logEntry = fetchedLogs.entries.first();
        if (!logEntry) return;

        const { executor } = logEntry;

        if (!(await shouldAction(guild, "guildupdate", executor.id))) return;

        // REVERSE THE DAMAGE: Revert to previous server profile details
        await guild.edit({
            name: oldGuild.name,
            icon: oldGuild.iconURL({ extension: 'png' }) || null,
            splash: oldGuild.splashURL({ extension: 'png' }) || null,
            banner: oldGuild.bannerURL({ extension: 'png' }) || null,
            verificationLevel: oldGuild.verificationLevel,
            defaultMessageNotifications: oldGuild.defaultMessageNotifications,
            explicitContentFilter: oldGuild.explicitContentFilter,
            reason: "Antinuke: Reverting illegal server alterations"
        }).catch(() => {});

        // PUNISH NUKER
        await punishExecutor(guild, executor.id, "Rogue Admin Modifying Server Identity");
    });
};
