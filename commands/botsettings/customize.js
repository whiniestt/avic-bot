const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionsBitField,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder
} = require('discord.js');
const dns = require('node:dns/promises');
const net = require('node:net');

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);
const MENU_ACTION_COOLDOWN_MS = 10_000;
const MENU_TIMEOUT_MS = 10 * 60 * 1000;
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

function helpContainer(prefix = ',') {
  const command = `${prefix}customize`;
  return new ContainerBuilder()
    .setAccentColor(0xD3D3D3)
    .addTextDisplayComponents(text('## Fare Customize'))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(
      'These settings affect Fare only in this server. Its global Discord profile will not change.\n\n' +
      `\`${command}\` — show the profile and action menu\n` +
      `\`${command} avatar [image link]\` — set the server avatar (or attach an image)\n` +
      `\`${command} banner [image link]\` — set the server banner (or attach an image)\n` +
      `\`${command} bio <text>\` — set the server bio\n` +
      `\`${command} sync\` — match the server name and icon; use its banner when available\n` +
      `\`${command} nick <name>\` — set the bot’s nickname in this server\n` +
      `\`${command} reset <all|bio|avatar|banner|nick>\` — reset server-profile settings\n\n` +
      '-# Avatar/banner images must be PNG, JPG, WEBP, or GIF and 8 MB or smaller.'
    ));
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

function profileMenuContainer(guild, profile, user, botAvatarUrl) {
  const status = value => value ? 'Custom' : 'Default';
  const profileText =
    `**Nickname:** ${profile.nick || 'Default'}\n` +
    `**Avatar:** ${status(profile.avatar)}\n` +
    `**Banner:** ${status(profile.banner)}\n` +
    `**Bio:** ${status(profile.bio)}`;

  const container = new ContainerBuilder().setAccentColor(0xD3D3D3);
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
      button('reset', 'Reset all', ButtonStyle.Danger)
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
    .setDescription('Choose an image file from your device.')
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

async function promptForImage(interaction, action, client, prefix = ',') {
  const modal = imageModal(action, interaction.id);
  const modalCustomId = `fare_customize_image:${interaction.id}`;
  await interaction.showModal(modal);

  let submitted;
  try {
    submitted = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
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
      `<@${submitted.user.id}>: Give an image link or upload a file, like \`${prefix}customize ${action} https://...\`.`,
      0xED4245,
      true
    ));
  }

  try {
    const imageData = await imageUrlToDataUri(imageUrl, uploadedFile?.size ?? null);
    await updateServerProfile(client, submitted.guild.id, { [action]: imageData });
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

  let botMember = message.guild.members.me;
  if (!botMember) {
    try {
      botMember = await message.guild.members.fetchMe();
    } catch (error) {
      console.error('SERVER BOT MEMBER FETCH ERROR:', error?.message || error);
    }
  }
  const botAvatarUrl = botMember?.displayAvatarURL({ extension: 'png', size: 256 }) ||
    client.user.displayAvatarURL({ extension: 'png', size: 256 });

  const sent = await message.reply({
    components: [profileMenuContainer(message.guild, profile, message.author, botAvatarUrl)],
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
        return await promptForImage(interaction, action, client, getPrefix(message));
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
      const prefix = getPrefix(message);
      const example = action === 'bio' ? '<text>' : '<name>';
      return interaction.reply(componentMessage(
        `<@${interaction.user.id}>: Use \`${prefix}customize ${action} ${example}\`.`,
        0xD3D3D3,
        true
      ));
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
        await updateServerProfile(client, interaction.guild.id, {
          avatar: null,
          banner: null,
          bio: null,
          nick: null
        });
        return interaction.reply(componentMessage(
          successText(`<@${interaction.user.id}>: Reset my look in this server.`),
          0x57F287,
          true
        ));
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

    if (!hasAdminPermission(message.member)) {
      return message.reply(componentMessage(
        errorText(`<@${message.author.id}>: Only server admins can change Fare’s server profile.`),
        0xED4245
      ));
    }

    const action = (args[0] || '').toLowerCase();
    const prefix = getPrefix(message);

    if (!action || action === 'help') {
      return showMenu(message, client);
    }

    let body;
    let successMessage;

    if (action === 'avatar' || action === 'banner') {
      const attachment = message.attachments.first();
      const imageUrl = attachment?.url || args[1];
      if (!imageUrl) {
        return message.reply(componentMessage(
          errorText(`<@${message.author.id}>: Give an image link or attach one, like \`${prefix}customize ${action} https://...\`.`),
          0xED4245
        ));
      }

      try {
        body = { [action]: await imageUrlToDataUri(imageUrl, attachment?.size ?? null) };
      } catch (error) {
        return message.reply(componentMessage(
          errorText(`<@${message.author.id}>: ${error.message || 'I could not use that image.'}`),
          0xED4245
        ));
      }
      successMessage = `Updated my server ${action}.`;
    } else if (action === 'bio') {
      const bio = args.slice(1).join(' ').trim();
      if (bio.toLowerCase() === 'clear') {
        body = { bio: null };
        successMessage = 'Cleared my bio in this server.';
      } else {
        if (!bio) {
          return message.reply(componentMessage(
            errorText(`<@${message.author.id}>: Give the bio text, like \`${prefix}customize bio <text>\`, or use \`${prefix}customize reset bio\` to clear it.`),
            0xED4245
          ));
        }
        if (bio.length > 190) {
          return message.reply(componentMessage(
            errorText(`<@${message.author.id}>: The server bio can be up to 190 characters.`),
            0xED4245
          ));
        }
        body = { bio };
        successMessage = 'Updated my bio in this server.';
      }
    } else if (action === 'nick') {
      const nick = args.slice(1).join(' ').trim();
      if (nick.toLowerCase() === 'clear') {
        body = { nick: null };
        successMessage = 'Cleared my nickname in this server.';
      } else {
        if (!nick) {
          return message.reply(componentMessage(
            errorText(`<@${message.author.id}>: Give a nickname, like \`${prefix}customize nick <name>\`, or use \`${prefix}customize reset nick\` to clear it.`),
            0xED4245
          ));
        }
        if (nick.length > 32) {
          return message.reply(componentMessage(
            errorText(`<@${message.author.id}>: The server nickname can be up to 32 characters.`),
            0xED4245
          ));
        }
        body = { nick };
        successMessage = 'Updated my nickname in this server.';
      }
    } else if (action === 'sync') {
      try {
        const { matched, notes } = await syncToServer(message.guild, client);
        const description =
          `Now matching the server: my **${matched.join(', ')}**` +
          (notes.length ? `\n-# ${notes.join('\n-# ')}` : '');
        return message.reply(componentMessage(
          successText(`<@${message.author.id}>: ${description}`),
          0x57F287
        ));
      } catch (error) {
        console.error('SERVER PROFILE SYNC ERROR:', error);
        return message.reply(componentMessage(
          errorText(`<@${message.author.id}>: Discord could not sync the server profile. Check the server image and try again.`),
          0xED4245
        ));
      }
    } else if (action === 'reset') {
      const target = (args[1] || '').toLowerCase();
      const resetBodies = {
        avatar: { avatar: null },
        banner: { banner: null },
        bio: { bio: null },
        nick: { nick: null },
        all: { avatar: null, banner: null, bio: null, nick: null }
      };
      if (!resetBodies[target]) {
        return message.reply(componentMessage(
          errorText(`<@${message.author.id}>: Use \`${prefix}customize reset <all|bio|avatar|banner|nick>\`. Example: \`${prefix}customize reset bio\`.`),
          0xED4245
        ));
      }
      body = resetBodies[target];
      successMessage = target === 'all'
        ? 'Reset my look in this server.'
        : `Reset my server ${target}.`;
    } else {
      return message.reply({
        components: [helpContainer(prefix)],
        flags: V2,
        allowedMentions: NO_PINGS
      });
    }

    try {
      await updateServerProfile(client, message.guild.id, body);
    } catch (error) {
      console.error('SERVER PROFILE UPDATE ERROR:', error);
      return message.reply(componentMessage(
        errorText(`<@${message.author.id}>: Discord could not update the server profile. Check the image or text and try again.`),
        0xED4245
      ));
    }

    return message.reply(componentMessage(
      successText(`<@${message.author.id}>: ${successMessage}`),
      0x57F287
    ));
  }
};
