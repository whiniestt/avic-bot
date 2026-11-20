const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
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

function errorEmbed(text) {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setDescription(`<:WarningIcon:1514708751385497721> ${text}`);
}

function userErrorEmbed(user, text) {
  return errorEmbed(`<@${user.id}>: ${text}`);
}

function successEmbed(user, text) {
  return new EmbedBuilder()
    .setColor('#57F287')
    .setDescription(`<:Tick:1514714190500335677> <@${user.id}>: ${text}`);
}

function helpEmbed(prefix = ',') {
  const command = `${prefix}customize`;
  return new EmbedBuilder()
    .setColor('#D3D3D3')
    .setTitle('Fare server profile')
    .setDescription(
      'These settings affect Fare only in this server. Fare’s global Discord profile will not change.\n\n' +
      `\`${command}\` — show the profile and action menu\n` +
      `\`${command} avatar [image link]\` — set the server avatar (or attach an image)\n` +
      `\`${command} banner [image link]\` — set the server banner (or attach an image)\n` +
      `\`${command} bio <text>\` — set the server bio\n` +
      `\`${command} sync\` — match the server name and icon; use its banner when available\n` +
      `\`${command} nick <name>\` — set Fare’s nickname in this server\n` +
      `\`${command} reset <all|bio|avatar|banner|nick>\` — reset server-profile settings\n\n` +
      '-# Avatar/banner images must be PNG, JPG, WEBP, or GIF and 8 MB or smaller.'
    );
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
    signal: AbortSignal.timeout(15000)
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
    throw new Error('Use a PNG, JPG, WEBP, or GIF image link.');
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

function profileMenuEmbed(guild, profile) {
  const status = value => value ? 'Custom' : 'Default';
  const embed = new EmbedBuilder()
    .setColor('#D3D3D3')
    .setTitle(`My look in ${guild.name}`)
    .setDescription(
      `**Nickname:** ${profile.nick || 'Default'}\n` +
      `**Avatar:** ${status(profile.avatar)}\n` +
      `**Banner:** ${status(profile.banner)}\n` +
      `**Bio:** ${status(profile.bio)}\n\n` +
      '-# Changes apply only to Fare in this server.'
    );
  const iconUrl = guild.iconURL({ extension: 'png', size: 256 });
  if (iconUrl) embed.setThumbnail(iconUrl);
  return embed;
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
  let notes = [];

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

async function showMenu(message, client) {
  let profile = {};
  try {
    profile = await readServerProfile(client, message.guild.id);
  } catch (error) {
    console.error('SERVER PROFILE READ ERROR:', error?.message || error);
  }

  const sent = await message.reply({
    embeds: [profileMenuEmbed(message.guild, profile)],
    components: menuRows(message.author.id)
  });

  let nextMutationAt = 0;
  const collector = sent.createMessageComponentCollector({
    time: MENU_TIMEOUT_MS,
    filter: interaction => interaction.user.id === message.author.id
  });

  collector.on('collect', async interaction => {
    const action = interaction.customId.split(':').at(-1);
    if (!hasAdminPermission(interaction.member, interaction.memberPermissions)) {
      return interaction.reply({
        embeds: [userErrorEmbed(interaction.user, 'Only server admins can change Fare’s server profile.')],
        ephemeral: true
      });
    }

    if (action === 'avatar' || action === 'banner') {
      const prefix = getPrefix(message);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#D3D3D3')
          .setDescription(
            `<@${interaction.user.id}>: Attach an image to a message with ` +
            `\`${prefix}customize ${action}\`, or use ` +
            `\`${prefix}customize ${action} https://...\`.`
          )],
        ephemeral: true
      });
    }

    if (action === 'bio' || action === 'nick') {
      const example = action === 'bio' ? '<text>' : '<name>';
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#D3D3D3')
          .setDescription(
            `<@${interaction.user.id}>: Use ` +
            `\`${getPrefix(message)}customize ${action} ${example}\`.`
          )],
        ephemeral: true
      });
    }

    const now = Date.now();
    if (now < nextMutationAt) {
      const timeLeft = Math.ceil((nextMutationAt - now) / 1000);
      return interaction.reply({
        embeds: [errorEmbed(`Wait ${timeLeft}s before the next menu action.`)],
        ephemeral: true
      });
    }
    nextMutationAt = now + MENU_ACTION_COOLDOWN_MS;

    try {
      if (action === 'sync') {
        const { matched, notes } = await syncToServer(interaction.guild, client);
        const description =
          `Now matching the server: my **${matched.join(', ')}**` +
          (notes.length ? `\n-# ${notes.join('\n-# ')}` : '');
        return interaction.reply({
          embeds: [successEmbed(interaction.user, description)],
          ephemeral: true
        });
      }

      if (action === 'reset') {
        await updateServerProfile(client, interaction.guild.id, {
          avatar: null,
          banner: null,
          bio: null,
          nick: null
        });
        return interaction.reply({
          embeds: [successEmbed(interaction.user, 'Reset my look in this server.')],
          ephemeral: true
        });
      }

      return interaction.reply({
        embeds: [errorEmbed('That menu action is no longer available. Run the command again.')],
        ephemeral: true
      });
    } catch (error) {
      console.error('SERVER PROFILE MENU ACTION ERROR:', error);
      return interaction.reply({
        embeds: [userErrorEmbed(interaction.user, 'Discord could not update the server profile. Check the image or text and try again.')],
        ephemeral: true
      });
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
      return message.reply({
        embeds: [errorEmbed('Use this command inside a server.')]
      });
    }

    if (!hasAdminPermission(message.member)) {
      return message.reply({
        embeds: [userErrorEmbed(message.author, 'Only server admins can change Fare’s server profile.')]
      });
    }

    const action = (args[0] || '').toLowerCase();
    const prefix = getPrefix(message);

    if (!action || action === 'help') {
      return showMenu(message, client);
    }

    let body;
    let successText;

    if (action === 'avatar' || action === 'banner') {
      const attachment = message.attachments.first();
      const imageUrl = attachment?.url || args[1];

      if (!imageUrl) {
        return message.reply({
          embeds: [userErrorEmbed(
            message.author,
            `Give an image link or attach one, like \`${prefix}customize ${action} https://...\``
          )]
        });
      }

      try {
        body = {
          [action]: await imageUrlToDataUri(imageUrl, attachment?.size ?? null)
        };
      } catch (error) {
        return message.reply({
          embeds: [userErrorEmbed(message.author, error.message || 'I could not use that image.')]
        });
      }
      successText = `Updated my server ${action}.`;
    } else if (action === 'bio') {
      const bio = args.slice(1).join(' ').trim();
      if (bio.toLowerCase() === 'clear') {
        body = { bio: null };
        successText = 'Cleared my bio in this server.';
      } else {
        if (!bio) {
          return message.reply({
            embeds: [userErrorEmbed(
              message.author,
              `Give the bio text, like \`${prefix}customize bio <text>\`, or use \`${prefix}customize reset bio\` to clear it.`
            )]
          });
        }
        if (bio.length > 190) {
          return message.reply({
            embeds: [userErrorEmbed(message.author, 'The server bio can be up to 190 characters.')]
          });
        }
        body = { bio };
        successText = 'Updated my bio in this server.';
      }
    } else if (action === 'nick') {
      const nick = args.slice(1).join(' ').trim();
      if (nick.toLowerCase() === 'clear') {
        body = { nick: null };
        successText = 'Cleared my nickname in this server.';
      } else {
        if (!nick) {
          return message.reply({
            embeds: [userErrorEmbed(
              message.author,
              `Give a nickname, like \`${prefix}customize nick <name>\`, or use \`${prefix}customize reset nick\` to clear it.`
            )]
          });
        }
        if (nick.length > 32) {
          return message.reply({
            embeds: [userErrorEmbed(message.author, 'The server nickname can be up to 32 characters.')]
          });
        }
        body = { nick };
        successText = 'Updated my nickname in this server.';
      }
    } else if (action === 'sync') {
      try {
        const { matched, notes } = await syncToServer(message.guild, client);
        const description =
          `Now matching the server: my **${matched.join(', ')}**` +
          (notes.length ? `\n-# ${notes.join('\n-# ')}` : '');
        return message.reply({
          embeds: [successEmbed(message.author, description)]
        });
      } catch (error) {
        console.error('SERVER PROFILE SYNC ERROR:', error);
        return message.reply({
          embeds: [userErrorEmbed(message.author, 'Discord could not sync the server profile. Check the server image and try again.')]
        });
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
        return message.reply({
          embeds: [userErrorEmbed(
            message.author,
            `Use \`${prefix}customize reset <all|bio|avatar|banner|nick>\`. Example: \`${prefix}customize reset bio\`.`
          )]
        });
      }

      body = resetBodies[target];
      successText = target === 'all'
        ? 'Reset my look in this server.'
        : `Reset my server ${target}.`;
    } else {
      return message.reply({ embeds: [helpEmbed(prefix)] });
    }

    try {
      await updateServerProfile(client, message.guild.id, body);
    } catch (error) {
      console.error('SERVER PROFILE UPDATE ERROR:', error);
      return message.reply({
        embeds: [userErrorEmbed(
          message.author,
          'Discord could not update the server profile. Check the image or text and try again.'
        )]
      });
    }

    return message.reply({
      embeds: [successEmbed(message.author, successText)]
    });
  }
};
