const { EmbedBuilder } = require('discord.js');
const {
  OWNER_ID,
  PREMIUM_DURATIONS,
  activatePremium,
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

    if (subcommand !== 'activate') {
      return replyEmbed(
        message,
        'Premium Activation',
        'Use `,premium activate @user <duration>`\n\n' +
        'Durations: `1m`, `3m`, `6m`, `lifetime`.\n' +
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
        'Use `,premium activate @user <1m|3m|6m|lifetime>`.' ,
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
