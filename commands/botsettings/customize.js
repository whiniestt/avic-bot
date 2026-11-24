const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionsBitField,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder
} = require('discord.js');
const dns = require('node:dns/promises');
const net = require('node:net');
const { hasPremium } = require('../../utils/entitlements');

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);
const MENU_ACTION_COOLDOWN_MS = 10_000;
const MENU_TIMEOUT_MS = 5 * 60 * 1000;
const V2 = MessageFlags.IsComponentsV2;
const NO_PINGS = { parse: [], repliedUser: false };
const text = content => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder()
  .setDivider(true)
  .setSpacing(SeparatorSpacingSize.Small);

function componentMessage(content, color = 0xD3D3D3, ephemeral = false) {
  return {
    components: [
      new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(text(content))
    ],
    flags: V2 | (ephemeral ? MessageFlags.Ephemeral : 0),
    allowedMentions: NO_PINGS
  };
}

function errorText(content) {
  return `<:WarningIcon:1514708751385497721> ${content}`;
}

function successText(content) {
  return `<:Tick:1514714190500335677> ${content}`;
}

function publicIPv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => value < 0 || value > 255)) {
    return false;
  }
  const [a, b] = octets;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function publicAddress(address) {
  if (net.isIPv4(address)) return publicIPv4(address);
  if (!net.isIPv6(address)) return false;

  const normalized = address.toLowerCase();
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
  ) {
    return false;
  }

  const mappedIPv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mappedIPv4 ? publicIPv4(mappedIPv4[1]) : true;
}

async function validateImageUrl(value) {
  let imageUrl;
  try {
    imageUrl = new URL(value);
  } catch {
    throw new Error('That does not look like a valid image link.');
  }

  if (
    imageUrl.protocol !== 'https:' ||
    imageUrl.username ||
    imageUrl.password ||
    imageUrl.hostname === 'localhost' ||
    imageUrl.hostname.endsWith('.localhost') ||
    imageUrl.hostname.endsWith('.local') ||
    imageUrl.hostname.endsWith('.internal')
  ) {
    throw new Error('Use a public HTTPS image link.');
  }

  if (net.isIP(imageUrl.hostname)) {
    if (!publicAddress(imageUrl.hostname)) {
      throw new Error('That image link is not publicly accessible.');
    }
  } else {
    let addresses;
    try {
      addresses = await dns.lookup(imageUrl.hostname, { all: true, verbatim: true });
    } catch {
      throw new Error('I could not find that image link. Check the URL and try again.');
    }
    if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) {
      throw new Error('That image link is not publicly accessible.');
    }
  }

  return imageUrl;
}

async function imageUrlToDataUri(value, knownSize = null) {
  if (knownSize !== null && knownSize > MAX_IMAGE_SIZE) {
    throw new Error('Images must be 8 MB or smaller.');
  }

  const imageUrl = await validateImageUrl(value);
  const response = await fetch(imageUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(15_000)
  });

  if (!response.ok) {
    throw new Error('I could not download that image. Please check the link or upload it again.');
  }

  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_SIZE) {
    throw new Error('Images must be 8 MB or smaller.');
  }

  const contentType = (response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Use a PNG, JPG, WEBP, or GIF image.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('I could not read that image. Please try again.');
  }

  const chunks = [];
  let totalSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalSize += value.byteLength;
    if (totalSize > MAX_IMAGE_SIZE) {
      await reader.cancel();
      throw new Error('Images must be 8 MB or smaller.');
    }
    chunks.push(Buffer.from(value));
  }

  return `data:${contentType};base64,${Buffer.concat(chunks).toString('base64')}`;
}

function getPrefix(message) {
  const commandToken = (message.content || '').trim().split(/\s+/, 1)[0] || '';
  const suffix = commandToken.match(/customi[sz]e$/i);
  return suffix ? commandToken.slice(0, -suffix[0].length) : ',';
}

function profileMenuContainer(guild, profile, user, botAvatarUrl, botBannerUrl) {
  const status = value => value ? 'Custom' : 'Default';
  const profileText =
    `**Nickname:** ${profile.nick || 'Default'}\n` +
    `**Avatar:** ${status(profile.avatar)}\n` +
    `**Banner:** ${status(profile.banner)}\n` +
    `**Bio:** ${status(profile.bio)}`;

  const container = new ContainerBuilder().setAccentColor(0xD3D3D3);
  if (botBannerUrl) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(botBannerUrl))
    );
  }
  if (botAvatarUrl) {
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        text(`## My look in ${guild.name}`),
        text(profileText)
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatarUrl));
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(
      text(`## My look in ${guild.name}`),
      text(profileText)
    );
  }

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('-# Changes apply only to Fare in this server.'))
    .addSeparatorComponents(divider())
    .addActionRowComponents(...menuRows(user.id))
    .addTextDisplayComponents(text(`-# Customize used by ${user.username}`));
}

function menuRows(userId) {
  const button = (action, label, style = ButtonStyle.Secondary) =>
    new ButtonBuilder()
      .setCustomId(`fare_customize:${userId}:${action}`)
      .setLabel(label)
      .setStyle(style);

  return [
    new ActionRowBuilder().addComponents(
      button('avatar', 'Avatar'),
      button('banner', 'Banner'),
      button('bio', 'Bio')
    ),
    new ActionRowBuilder().addComponents(
      button('nick', 'Nickname'),
      button('reset', 'Reset', ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      button('sync', 'Sync with server', ButtonStyle.Primary)
    )
  ];
}

async function readServerProfile(client, guildId) {
  return client.rest.get(`/guilds/${guildId}/members/@me`);
}

async function updateServerProfile(client, guildId, body) {
  return client.rest.patch(`/guilds/${guildId}/members/@me`, { body });
}

async function getServerBotMember(guild, forceRefresh = false) {
  let botMember = guild.members.me;
  if (!botMember || forceRefresh) {
    try {
      botMember = await guild.members.fetchMe(forceRefresh ? { force: true } : undefined);
    } catch (error) {
      console.error('SERVER BOT MEMBER FETCH ERROR:', error?.message || error);
    }
  }
  return botMember || null;
}

function getServerBotAvatarUrl(botMember, client) {
  return botMember?.displayAvatarURL({ extension: 'png', size: 256 }) ||
    client.user.displayAvatarURL({ extension: 'png', size: 256 });
}

function getServerBotBannerUrl(botMember, client) {
  return botMember?.displayBannerURL({ extension: 'png', size: 1024 }) ||
    client.user.bannerURL({ extension: 'png', size: 1024 }) || null;
}

async function promptForReset(interaction, client, menuProfile) {
  const selectCustomId = `fare_customize_reset:${interaction.id}`;
  const resetSelect = new StringSelectMenuBuilder()
    .setCustomId(selectCustomId)
    .setPlaceholder('Choose what to reset')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Nickname').setValue('nick'),
      new StringSelectMenuOptionBuilder().setLabel('Avatar').setValue('avatar'),
      new StringSelectMenuOptionBuilder().setLabel('Banner').setValue('banner'),
      new StringSelectMenuOptionBuilder().setLabel('Bio').setValue('bio'),
      new StringSelectMenuOptionBuilder().setLabel('All').setValue('all')
    );
  const prompt = new ContainerBuilder()
    .setAccentColor(0xD3D3D3)
    .addTextDisplayComponents(text('## What do you want to reset?'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(resetSelect));

  await interaction.reply({
    components: [prompt],
    flags: V2 | MessageFlags.Ephemeral,
    allowedMentions: NO_PINGS
  });

  const promptMessage = await interaction.fetchReply();
  let selection;
  try {
    selection = await promptMessage.awaitMessageComponent({
      time: MENU_TIMEOUT_MS,
      filter: component =>
        component.customId === selectCustomId &&
        component.user.id === interaction.user.id
    });
  } catch {
    await promptMessage.edit({ components: [] }).catch(() => {});
    return;
  }

  const target = selection.values[0];
  const labels = {
    nick: 'nickname',
    avatar: 'avatar',
    banner: 'banner',
    bio: 'bio',
    all: 'all profile settings'
  };
  const resetBodies = {
    nick: { nick: null },
    avatar: { avatar: null },
    banner: { banner: null },
    bio: { bio: null },
    all: { nick: null, avatar: null, banner: null, bio: null }
  };
  if (!Object.hasOwn(labels, target)) {
    return selection.update(componentMessage('That reset option is no longer available.', 0xED4245, true));
  }

  try {
    await selection.deferUpdate();
    await updateServerProfile(client, interaction.guild.id, resetBodies[target]);
    await refreshCustomizeMenu(
      interaction.message,
      interaction.guild,
      interaction.user,
      client,
      menuProfile,
      target
    );
    return selection.followUp(componentMessage(
      successText(`<@${interaction.user.id}>: Reset my server ${labels[target]}.`),
      0x57F287,
      true
    ));
  } catch (error) {
    console.error('SERVER PROFILE RESET ERROR:', error);
    return selection.followUp(componentMessage(
      errorText('Discord could not reset that server-profile setting.'),
      0xED4245,
      true
    ));
  }
}

async function refreshCustomizeMenu(menuMessage, guild, user, client, previousProfile, changedAction) {
  let profile = { ...previousProfile, [changedAction]: 'updated' };
  try {
    profile = await readServerProfile(client, guild.id);
  } catch (error) {
    console.error('SERVER PROFILE REFRESH ERROR:', error?.message || error);
  }

  const botMember = await getServerBotMember(guild, true);
  const botAvatarUrl = getServerBotAvatarUrl(botMember, client);
  const botBannerUrl = getServerBotBannerUrl(botMember, client);
  try {
    await menuMessage.edit({
      components: [profileMenuContainer(guild, profile, user, botAvatarUrl, botBannerUrl)],
      flags: V2,
      allowedMentions: NO_PINGS
    });
  } catch (error) {
    console.error('CUSTOMIZE MENU REFRESH ERROR:', error?.message || error);
  }
}

async function syncToServer(guild, client) {
  const body = { nick: guild.name.slice(0, 32) };
  const matched = ['name'];
  const notes = [];

  const iconUrl = guild.iconURL({ extension: 'png', size: 1024 });
  if (iconUrl) {
    body.avatar = await imageUrlToDataUri(iconUrl);
    matched.push('avatar');
  } else {
    notes.push('The server has no icon — I kept mine.');
  }

  const bannerUrl = guild.bannerURL({ extension: 'png', size: 1024 });
  if (bannerUrl) {
    body.banner = await imageUrlToDataUri(bannerUrl);
    matched.push('banner');
  } else {
    notes.push('The server has no banner — I kept mine.');
  }

  await updateServerProfile(client, guild.id, body);
  return { matched, notes };
}

function hasAdminPermission(member, permissionOverride = null) {
  const permissions = permissionOverride || member?.permissions;
  if (!permissions) return false;

  try {
    const bitfield = permissions instanceof PermissionsBitField
      ? permissions
      : new PermissionsBitField(permissions);
    return bitfield.has(PermissionsBitField.Flags.ManageGuild) ||
      bitfield.has(PermissionsBitField.Flags.Administrator);
  } catch {
    return false;
  }
}

function imageModal(action, interactionId) {
  const modal = new ModalBuilder()
    .setCustomId(`fare_customize_image:${interactionId}`)
    .setTitle(action === 'avatar' ? 'Server avatar' : 'Server banner');

  const fileUpload = new FileUploadBuilder()
    .setCustomId('customize_image_file')
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(1)
    .setFileTypes('image');
  const uploadLabel = new LabelBuilder()
    .setLabel(action === 'avatar' ? 'Upload an avatar' : 'Upload a banner')
    .setDescription('Choose a PNG, JPG, WEBP, or GIF image (8 MB max).')
    .setFileUploadComponent(fileUpload);

  const imageLink = new TextInputBuilder()
    .setCustomId('customize_image_url')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('https://...');
  const linkLabel = new LabelBuilder()
    .setLabel('Or paste a link')
    .setDescription('Leave this blank if you uploaded a file.')
    .setTextInputComponent(imageLink);

  return modal.addLabelComponents(uploadLabel, linkLabel);
}

function profileTextModal(action, interactionId) {
  const isBio = action === 'bio';
  const input = new TextInputBuilder()
    .setCustomId('customize_profile_text')
    .setStyle(isBio ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(isBio ? 190 : 32)
    .setPlaceholder(isBio ? 'Enter Fare’s server bio' : 'Enter Fare’s server nickname');
  const label = new LabelBuilder()
    .setLabel(isBio ? 'Server bio' : 'Server nickname')
    .setTextInputComponent(input);

  return new ModalBuilder()
    .setCustomId(`fare_customize_text:${interactionId}`)
    .setTitle(isBio ? 'Set server bio' : 'Set server nickname')
    .addLabelComponents(label);
}

async function promptForText(interaction, action, client, menuProfile) {
  const modalCustomId = `fare_customize_text:${interaction.id}`;
  await interaction.showModal(profileTextModal(action, interaction.id));

  let submitted;
  try {
    submitted = await interaction.awaitModalSubmit({
      time: MENU_TIMEOUT_MS,
      filter: modalInteraction =>
        modalInteraction.customId === modalCustomId &&
        modalInteraction.user.id === interaction.user.id
    });
  } catch {
    return;
  }

  const value = submitted.fields.getTextInputValue('customize_profile_text').trim();
  const label = action === 'bio' ? 'bio' : 'nickname';
  if (!value) {
    return submitted.reply(componentMessage(
      errorText(`<@${submitted.user.id}>: Enter a ${label}, or use Reset to clear it.`),
      0xED4245,
      true
    ));
  }

  try {
    await updateServerProfile(client, submitted.guild.id, { [action]: value });
    await refreshCustomizeMenu(
      interaction.message,
      submitted.guild,
      submitted.user,
      client,
      menuProfile,
      action
    );
    return submitted.reply(componentMessage(
      successText(`<@${submitted.user.id}>: Updated my server ${label}.`),
      0x57F287,
      true
    ));
  } catch (error) {
    console.error(`SERVER PROFILE ${action.toUpperCase()} ERROR:`, error);
    return submitted.reply(componentMessage(
      errorText(`<@${submitted.user.id}>: ${error.message || 'Discord could not update the server profile.'}`),
      0xED4245,
      true
    ));
  }
}

async function promptForImage(interaction, action, client, menuProfile = {}) {
  const modal = imageModal(action, interaction.id);
  const modalCustomId = `fare_customize_image:${interaction.id}`;
  await interaction.showModal(modal);

  let submitted;
  try {
    submitted = await interaction.awaitModalSubmit({
      time: MENU_TIMEOUT_MS,
      filter: modalInteraction =>
        modalInteraction.customId === modalCustomId &&
        modalInteraction.user.id === interaction.user.id
    });
  } catch {
    return;
  }

  const uploadedFile = submitted.fields
    .getUploadedFiles('customize_image_file')
    ?.first();
  const link = submitted.fields
    .getTextInputValue('customize_image_url')
    .trim();
  const imageUrl = uploadedFile?.url || link;

  if (!imageUrl) {
    return submitted.reply(componentMessage(
      `<@${submitted.user.id}>: Upload an image or paste its link in the form.`,
      0xED4245,
      true
    ));
  }

  try {
    const imageData = await imageUrlToDataUri(imageUrl, uploadedFile?.size ?? null);
    await updateServerProfile(client, submitted.guild.id, { [action]: imageData });
    await refreshCustomizeMenu(
      interaction.message,
      submitted.guild,
      submitted.user,
      client,
      menuProfile,
      action
    );
    return submitted.reply(componentMessage(
      successText(`<@${submitted.user.id}>: Updated my server ${action}.`),
      0x57F287,
      true
    ));
  } catch (error) {
    console.error(`SERVER PROFILE ${action.toUpperCase()} ERROR:`, error);
    return submitted.reply(componentMessage(
      errorText(`<@${submitted.user.id}>: ${error.message || 'Discord could not update the server profile.'}`),
      0xED4245,
      true
    ));
  }
}

async function showMenu(message, client) {
  let profile = {};
  try {
    profile = await readServerProfile(client, message.guild.id);
  } catch (error) {
    console.error('SERVER PROFILE READ ERROR:', error?.message || error);
  }

  const botMember = await getServerBotMember(message.guild);
  const botAvatarUrl = getServerBotAvatarUrl(botMember, client);
  const botBannerUrl = getServerBotBannerUrl(botMember, client);

  const sent = await message.reply({
    components: [profileMenuContainer(message.guild, profile, message.author, botAvatarUrl, botBannerUrl)],
    flags: V2,
    allowedMentions: NO_PINGS
  });

  let nextMutationAt = 0;
  const collector = sent.createMessageComponentCollector({
    time: MENU_TIMEOUT_MS,
    filter: interaction => interaction.customId.startsWith('fare_customize:')
  });

  collector.on('collect', async interaction => {
    const [, userId, action] = interaction.customId.split(':');
    if (interaction.user.id !== userId) {
      return interaction.reply(componentMessage(
        'This customize menu is not yours.',
        0xED4245,
        true
      ));
    }

    if (!hasAdminPermission(interaction.member, interaction.memberPermissions)) {
      return interaction.reply(componentMessage(
        errorText('Only server admins can change Fare’s server profile.'),
        0xED4245,
        true
      ));
    }

    const now = Date.now();
    if (now < nextMutationAt) {
      const timeLeft = Math.ceil((nextMutationAt - now) / 1000);
      return interaction.reply(componentMessage(
        errorText(`Wait ${timeLeft}s before the next menu action.`),
        0xED4245,
        true
      ));
    }
    nextMutationAt = now + MENU_ACTION_COOLDOWN_MS;

    if (action === 'avatar' || action === 'banner') {
      try {
        return await promptForImage(interaction, action, client, profile);
      } catch (error) {
        console.error('CUSTOMIZE IMAGE MODAL ERROR:', error);
        if (!interaction.replied && !interaction.deferred) {
          return interaction.reply(componentMessage(
            errorText('I could not open the image form. Please try again.'),
            0xED4245,
            true
          ));
        }
        return;
      }
    }

    if (action === 'bio' || action === 'nick') {
      try {
        return await promptForText(interaction, action, client, profile);
      } catch (error) {
        console.error('CUSTOMIZE TEXT MODAL ERROR:', error);
        if (!interaction.replied && !interaction.deferred) {
          return interaction.reply(componentMessage(
            errorText('I could not open the text form. Please try again.'),
            0xED4245,
            true
          ));
        }
        return;
      }
    }

    try {
      if (action === 'sync') {
        const { matched, notes } = await syncToServer(interaction.guild, client);
        const description =
          `Now matching the server: my **${matched.join(', ')}**` +
          (notes.length ? `\n-# ${notes.join('\n-# ')}` : '');
        return interaction.reply(componentMessage(
          successText(`<@${interaction.user.id}>: ${description}`),
          0x57F287,
          true
        ));
      }

      if (action === 'reset') {
        return promptForReset(interaction, client, profile);
      }

      return interaction.reply(componentMessage(
        errorText('That menu action is no longer available. Run the command again.'),
        0xED4245,
        true
      ));
    } catch (error) {
      console.error('SERVER PROFILE MENU ACTION ERROR:', error);
      return interaction.reply(componentMessage(
        errorText('Discord could not update the server profile. Check the image or text and try again.'),
        0xED4245,
        true
      ));
    }
  });

  collector.on('end', () => {
    sent.edit({ components: [] }).catch(() => {});
  });
}

module.exports = {
  name: 'customize',
  aliases: ['customise'],

  async execute(message, args, client) {
    if (!message.guild || !message.member) {
      return message.reply(componentMessage(
        errorText('Use this command inside a server.'),
        0xED4245
      ));
    }

    if (!(await hasPremium(message.author.id))) {
      return message.reply(componentMessage(
        errorText('Customize is available to Premium members only. Ask Fare’s owner to activate Premium for you.'),
        0xED4245
      ));
    }

    if (!hasAdminPermission(message.member)) {
      return message.reply(componentMessage(
        errorText(`<@${message.author.id}>: Only server admins can change Fare’s server profile.`),
        0xED4245
      ));
    }

    if (!args.length) {
      return showMenu(message, client);
    }

    return;
  }
};
