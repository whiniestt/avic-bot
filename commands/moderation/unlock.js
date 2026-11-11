const { PermissionsBitField, EmbedBuilder } = require('discord.js');

function errorEmbed(text) {
  return new EmbedBuilder().setColor('#D3D3D3').setDescription(`<:WarningIcon:1514708751385497721> ${text}`);
}

module.exports = {
  name: 'unlock',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply({ embeds: [errorEmbed("You don't have permission to unlock channels.")] });
    }

    const channel = message.mentions.channels.first() || message.channel;

    await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: null,
      SendMessagesInThreads: null,
      CreatePublicThreads: null,
      CreatePrivateThreads: null,
    });

    channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#D3D3D3')
          .setTitle('<:WarningIcon:1514708751385497721> Channel Unlocked')
          .setDescription(
            `<:arrow:1514699753462566953> **Channel** • ${channel}\n` +
            `<:arrow:1514699753462566953> **Moderator** • ${message.author.tag}`
          ),
      ],
    });
  },
};
