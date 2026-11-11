const { PermissionsBitField, EmbedBuilder } = require('discord.js');

function errorEmbed(text) {
  return new EmbedBuilder().setColor('#ED4245').setDescription(`<:WarningIcon:1514708751385497721> ${text}`);
}

module.exports = {
  name: 'lock',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply({ embeds: [errorEmbed("You don't have permission to lock channels.")] });
    }

    const channel = message.mentions.channels.first() || message.channel;

    await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false,
      SendMessagesInThreads: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
    });

    channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('<:WarningIcon:1514708751385497721> Channel Locked')
          .setDescription(
            `<:arrow:1514699753462566953> **Channel** • ${channel}\n` +
            `<:arrow:1514699753462566953> Messages and threads are locked for everyone.\n` +
            `<:arrow:1514699753462566953> **Moderator** • ${message.author.tag}`
          ),
      ],
    });
  },
};
