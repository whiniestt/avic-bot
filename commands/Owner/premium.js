const { EmbedBuilder } = require('discord.js');
const db = require('../../database');
const {
  OWNER_ID,
  PREMIUM_DURATIONS,
  activatePremium,
  hasPremium,
  hasStandaloneNoPrefix,
  formatDuration,
  formatExpiration
} = require('../../utils/entitlements');

function replyEmbed(message, title, description, color = '#D3D3D3') {
  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
    ],
    allowedMentions: { parse: [] }
  });
}

async function listPremiumMembers(message) {
  const entries = (await db.all())
    .filter(entry => entry.id.startsWith('premium_'));
  const users = [];
  const seen = new Set();

  for (const entry of entries) {
    const userId = entry.id.slice('premium_'.length);
    if (userId === OWNER_ID || seen.has(userId)) continue;
    if (!(await hasPremium(userId))) continue;

    const grant = await db.get(entry.id);
    const expiry = grant?.expiresAt === null
      ? 'lifetime'
      : grant?.expiresAt
        ? `expires <t:${Math.floor(grant.expiresAt / 1000)}:R>`
        : 'active';

    users.push(`<@${userId}> — ${expiry}`);
    seen.add(userId);
  }

  users.unshift(`<@${OWNER_ID}> — owner access (permanent)`);

  const visibleUsers = users.slice(0, 40);
  if (users.length > visibleUsers.length) {
    visibleUsers.push(`…and ${users.length - visibleUsers.length} more.`);
  }

  return replyEmbed(
    message,
    '<:premium:1514699759250575472> Premium Members',
    visibleUsers.join('\n')
  );
}

module.exports = {
  name: 'premium',

  async execute(message, args) {
    if (message.author.id !== OWNER_ID) {
      return replyEmbed(
        message,
        'Owner Only',
        '<:WarningIcon:1514708751385497721> Only Fare’s owner can manage Premium.',
        '#FF7F7F'
      );
    }

    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'list') {
      return listPremiumMembers(message);
    }

    if (subcommand === 'remove') {
      const target = message.mentions.users.first();
      if (!target) {
        return replyEmbed(
          message,
          'Invalid Removal',
          'Use `,premium remove @user`.',
          '#FF7F7F'
        );
      }

      if (target.id === OWNER_ID) {
        return replyEmbed(
          message,
          'Owner Access',
          'The bot owner has permanent Premium access.',
          '#FF7F7F'
        );
      }

      await db.delete(`premium_${target.id}`);
      const standaloneNoPrefix = await hasStandaloneNoPrefix(target.id);
      const description = standaloneNoPrefix
        ? `Premium was removed from <@${target.id}>. Their separate no-prefix grant remains; use ` +
          '`,noprefix remove @user` too if you need to revoke that.'
        : `Premium was removed from <@${target.id}>. Their Customize access and Premium-included no-prefix have ended.`;

      return replyEmbed(
        message,
        'Premium Removed',
        description,
        '#D3D3D3'
      );
    }

    if (subcommand !== 'activate') {
      return replyEmbed(
        message,
        'Premium Management',
        '`,premium activate @user <1m|3m|6m|lifetime>`\n' +
        '`,premium remove @user`\n' +
        '`,premium list`\n\n' +
        'Premium includes global no-prefix and the `customize` command in servers where the member has Manage Server or Administrator permission.'
      );
    }

    const target = message.mentions.users.first();
    const duration = args
      .slice(1)
      .map(value => value.toLowerCase())
      .find(value => PREMIUM_DURATIONS.includes(value));

    if (!target || !duration) {
      return replyEmbed(
        message,
        'Invalid Activation',
        'Use `,premium activate @user <1m|3m|6m|lifetime>`.',
        '#FF7F7F'
      );
    }

    const grant = await activatePremium(target.id, duration);
    if (!grant) {
      return replyEmbed(
        message,
        'Invalid Duration',
        'Choose `1m`, `3m`, `6m`, or `lifetime`.',
        '#FF7F7F'
      );
    }

    return replyEmbed(
      message,
      '<:premium:1514699759250575472> Premium Activated',
      `Premium is active for <@${target.id}>.\n\n` +
      `**Duration:** ${formatDuration(duration)}\n` +
      `**Access:** Customize in servers where they have Manage Server or Administrator permission, plus no-prefix across all servers.\n` +
      `**${formatExpiration(grant.expiresAt)}**`,
      '#D3D3D3'
    );
  }
};
