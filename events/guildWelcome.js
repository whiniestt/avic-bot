const {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const EMBED_COLOR = 0x3D4752;
const SUPPORT_URL = 'https://discord.gg/R5CRRPaBhA';
const WEBSITE_URL = 'https://farewaves.vercel.app/';
const AUDIT_LOG_RETRY_DELAY_MS = 1500;
const AUDIT_LOG_MAX_AGE_MS = 5 * 60 * 1000;
const REMOVAL_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function createWelcomePayload(guild, client) {
  const botIcon = client.user.displayAvatarURL({ extension: 'png', size: 256 });
  const serverLabel = (guild.name || 'Open server').slice(0, 80);
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      '<:greydot:1572958848132587530> **Thanks for adding Fare!**\n\n' +
      '<:greydot:1572958848132587530> My default prefix is `,`\n' +
      '<:greydot:1572958848132587530> Use `,help` or `/help` in the server for commands\n' +
      `<:greydot:1572958848132587530> For questions or details join **[Support Server](${SUPPORT_URL})**`
    )
    .setThumbnail(botIcon)
    .setFooter({ text: 'By Fare Development', iconURL: botIcon })
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Support Server')
      .setStyle(ButtonStyle.Link)
      .setURL(SUPPORT_URL),
    new ButtonBuilder()
      .setLabel('Website')
      .setStyle(ButtonStyle.Link)
      .setURL(WEBSITE_URL),
    new ButtonBuilder()
      .setLabel(serverLabel)
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guild.id}`)
  );

  return { embeds: [embed], components: [buttons], allowedMentions: { parse: [] } };
}

function createRemovalPayload(guild, client) {
  const botIcon = client.user.displayAvatarURL({ extension: 'png', size: 256 });
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(
      `<:greydot:1572958848132587530> Fare has been removed from **${guild.name}**.`
    )
    .setThumbnail(botIcon)
    .setFooter({ text: 'By Fare Development', iconURL: botIcon })
    .setTimestamp();

  return { embeds: [embed], allowedMentions: { parse: [] } };
}

function getAuditTargetId(entry) {
  return entry.target?.id || entry.targetId;
}

async function findRecentBotRemover(guild, botUserId) {
  const auditLogs = await guild.fetchAuditLogs({
    limit: 10,
    type: AuditLogEvent.MemberKick
  });
  const entry = auditLogs.entries.find(candidate => {
    const createdAt = candidate.createdTimestamp || Date.now();
    return getAuditTargetId(candidate) === botUserId &&
      Date.now() - createdAt <= AUDIT_LOG_MAX_AGE_MS;
  });

  return entry?.executor?.id || entry?.executorId || null;
}

async function findBotAdder(guild, botUserId) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 10,
        type: AuditLogEvent.BotAdd
      });
      const entry = auditLogs.entries.find(candidate => {
        const targetId = candidate.target?.id || candidate.targetId;
        const createdAt = candidate.createdTimestamp || Date.now();
        return targetId === botUserId && Date.now() - createdAt <= AUDIT_LOG_MAX_AGE_MS;
      });

      if (entry?.executor?.id) {
        const executorId = entry.executor.id;
        if (executorId === guild.ownerId) return executorId;

        const member = await guild.members.fetch(executorId).catch(() => null);
        if (member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
          return executorId;
        }
        return null;
      }
    } catch (error) {
      if (attempt === 3) {
        console.warn(`WELCOME AUDIT LOG ERROR (${guild.id}):`, error?.message || error);
      }
    }

    if (attempt < 3) await wait(AUDIT_LOG_RETRY_DELAY_MS);
  }

  return null;
}

module.exports = client => {
  const recentRemovers = new Map();

  client.on('guildCreate', async guild => {
    const payload = createWelcomePayload(guild, client);
    const systemChannel = guild.systemChannel;

    if (systemChannel?.isTextBased()) {
      try {
        await systemChannel.send(payload);
      } catch (error) {
        console.warn(`WELCOME CHANNEL SEND ERROR (${guild.id}):`, error?.message || error);
      }
    } else {
      console.warn(`WELCOME CHANNEL SKIPPED (${guild.id}): no system text channel is configured.`);
    }

    const adderLookup = findBotAdder(guild, client.user.id);
    const recipientIds = new Set();
    if (guild.ownerId) recipientIds.add(guild.ownerId);

    for (const userId of recipientIds) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(payload);
      } catch (error) {
        console.warn(`WELCOME OWNER DM ERROR (${guild.id}, ${userId}):`, error?.message || error);
      }
    }

    const adderId = await adderLookup;
    if (adderId && !recipientIds.has(adderId)) {
      try {
        const adder = await client.users.fetch(adderId);
        await adder.send(payload);
      } catch (error) {
        console.warn(`WELCOME ADDER DM ERROR (${guild.id}, ${adderId}):`, error?.message || error);
      }
    }
  });

  client.on('guildAuditLogEntryCreate', (entry, guild) => {
    if (!guild || entry.action !== AuditLogEvent.MemberKick) return;
    if (getAuditTargetId(entry) !== client.user.id) return;

    const actorId = entry.executor?.id || entry.executorId;
    if (!actorId) return;

    recentRemovers.set(guild.id, {
      actorId,
      createdAt: entry.createdTimestamp || Date.now()
    });
  });

  client.on('guildDelete', async guild => {
    if (guild.unavailable) return;

    // Give the audit-log gateway event a moment to arrive before checking the cache.
    await wait(AUDIT_LOG_RETRY_DELAY_MS);

    const cachedRemoval = recentRemovers.get(guild.id);
    recentRemovers.delete(guild.id);

    let removerId = null;
    if (cachedRemoval && Date.now() - cachedRemoval.createdAt <= REMOVAL_CACHE_MAX_AGE_MS) {
      removerId = cachedRemoval.actorId;
    }

    if (!removerId) {
      try {
        removerId = await findRecentBotRemover(guild, client.user.id);
      } catch (error) {
        console.warn(`REMOVAL AUDIT LOG LOOKUP ERROR (${guild.id}):`, error?.message || error);
      }
    }

    const recipientIds = new Set();
    if (guild.ownerId) recipientIds.add(guild.ownerId);
    if (removerId) recipientIds.add(removerId);

    const payload = createRemovalPayload(guild, client);
    for (const userId of recipientIds) {
      try {
        const user = await client.users.fetch(userId);
        await user.send(payload);
      } catch (error) {
        console.warn(`REMOVAL DM ERROR (${guild.id}, ${userId}):`, error?.message || error);
      }
    }
  });
};
