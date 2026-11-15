const {
  EmbedBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');

const MAX_AGE = 24 * 60 * 60 * 1000;
const NO_PINGS = { parse: [], repliedUser: false }; // stops sniped @everyone/@role text from pinging

module.exports = {
  name: 'snipe',
  async execute(message, args, client) {
    const now = Date.now();
    const list = (client.snipes?.get(message.channel.id) || []).filter((s) => now - s.time < MAX_AGE);

    if (!list.length) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FAA61A')
            .setDescription(`<:WarningIcon:1514708751385497721> ${message.author}: No deleted messages found in this channel.`),
        ],
      });
    }

    let index = 0;

    const render = (disabled = false) => {
      const s = list[index];
      const single = list.length < 2;

      const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${s.authorName}**`))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(s.content ? s.content.slice(0, 1800) : '*No text content*')
        );

      if (s.image) {
        container.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(s.image))
        );
      }

      container
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Deleted <t:${Math.floor(s.time / 1000)}:R> • ${index + 1}/${list.length} messages`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('snipe_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(disabled || single),
            new ButtonBuilder().setCustomId('snipe_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(disabled || single),
            new ButtonBuilder().setCustomId('snipe_jump').setLabel('Jump').setStyle(ButtonStyle.Secondary).setDisabled(disabled || single)
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('snipe_stop').setLabel('Terminate').setStyle(ButtonStyle.Danger).setDisabled(disabled)
          )
        );

      return container;
    };

    const payload = (disabled = false) => ({
      components: [render(disabled)],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: NO_PINGS,
    });

    const msg = await message.reply(payload());
    const collector = msg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          content: "<a:spider_cross:1514728338701287640> This interaction isn't yours.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.customId === 'snipe_prev') {
        index = (index - 1 + list.length) % list.length;
        return interaction.update(payload());
      }

      if (interaction.customId === 'snipe_next') {
        index = (index + 1) % list.length;
        return interaction.update(payload());
      }

      if (interaction.customId === 'snipe_stop') {
        collector.stop('terminated');
        await interaction.deferUpdate();
        return msg.delete().catch(() => {});
      }

      if (interaction.customId === 'snipe_jump') {
        const modalId = `snipe_jump_${msg.id}`;

        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('Jump to message')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('num')
                  .setLabel(`Message number (1-${list.length})`)
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              )
            )
        );

        const submit = await interaction
          .awaitModalSubmit({
            time: 30000,
            filter: (i) => i.customId === modalId && i.user.id === interaction.user.id,
          })
          .catch(() => null);

        if (!submit) return;

        const n = parseInt(submit.fields.getTextInputValue('num'), 10);
        if (isNaN(n) || n < 1 || n > list.length) {
          return submit.reply({
            content: `<a:spider_cross:1514728338701287640> Enter a number between 1 and ${list.length}.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        index = n - 1;
        return submit.update(payload());
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'terminated') return;
      msg.edit(payload(true)).catch(() => {});
    });
  },
};
