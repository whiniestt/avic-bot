const {
  PermissionsBitField,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  Routes
} = require('discord.js');

const OWNER_ID = '1530872106399567941';

const FONTS = { default: 11, tempo: 1, sakura: 3, jellybean: 4, modern: 6, medieval: 7, '8bit': 8, vampyre: 10 };
const EFFECTS = { solid: 1, gradient: 2, neon: 3, toon: 4, pop: 5, glow: 6 };

const isHex = (s) => /^#?[0-9a-fA-F]{6}$/.test(s || '');
const hexToDecimal = (hex) => parseInt(hex.replace('#', ''), 16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function box(message, text, color) {
  const c = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  if (color) c.setAccentColor(color);
  return message.reply({
    components: [c],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [], repliedUser: false }
  });
}

const err = (message, text) => box(message, `<:WarningIcon:1514708751385497721> ${text}`, 0xED4245);
const ok = (message, text) => box(message, `<:WarningIcon:1514708751385497721> ${text}`);

// Returns { body } or { error }
function parseStyle(args) {
  const [font, effect, ...colors] = args.map((a) => a.toLowerCase());

  if (!(font in FONTS)) return { error: `Unknown font. Options: ${Object.keys(FONTS).map((f) => `\`${f}\``).join(', ')}` };
  if (!(effect in EFFECTS)) return { error: `Unknown effect. Options: ${Object.keys(EFFECTS).map((e) => `\`${e}\``).join(', ')}` };

  const needed = effect === 'gradient' ? 2 : 1;
  if (colors.length !== needed || !colors.every(isHex)) {
    return { error: `\`${effect}\` needs exactly ${needed} hex colour${needed > 1 ? 's' : ''}, e.g. \`#FF69B4\`.` };
  }

  return {
    body: {
      display_name_font_id: FONTS[font],
      display_name_effect_id: EFFECTS[effect],
      display_name_colors: colors.map(hexToDecimal)
    }
  };
}

module.exports = {
  name: 'nameplate',
  aliases: ['botstyle'],

  async execute(message, args, client) {
    const isOwner = message.author.id === OWNER_ID;

    if (!isOwner && !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return err(message, "You don't have permission to change the bot's nameplate.");
    }

    const sub = args[0]?.toLowerCase();

    // =========================
    // HELP
    // =========================
    if (!sub || sub === 'list') {
      return box(
        message,
`### Nameplate Customize
**__Fonts__**
${Object.keys(FONTS).map((f) => `\`${f}\``).join(' , ')}

**__Effects__**
${Object.keys(EFFECTS).map((e) => `\`${e}\``).join(' , ')}

**__Usage__**
\`nameplate <font> <effect> <#hex>\`
\`nameplate <font> gradient <#hex> <#hex>\`
\`nameplate reset\`
\`nameplate all <font> <effect> <#hex...>\` (owner only)

-# Applies to this server only.`
      );
    }

    // =========================
    // RESET
    // =========================
    if (sub === 'reset') {
      try {
        await client.rest.patch(Routes.guildMember(message.guild.id, '@me'), {
          body: { display_name_font_id: 0, display_name_effect_id: 0, display_name_colors: [] }
        });
        return ok(message, 'Nameplate reset to default in this server.');
      } catch (e) {
        return err(message, `Couldn't reset it: \`${e.message}\``);
      }
    }

    // =========================
    // ALL SERVERS (owner only)
    // =========================
    if (sub === 'all') {
      if (!isOwner) return err(message, 'Only the bot owner can apply a nameplate to every server.');

      const parsed = parseStyle(args.slice(1));
      if (parsed.error) return err(message, parsed.error);

      let done = 0;
      let failed = 0;

      for (const guild of client.guilds.cache.values()) {
        try {
          await client.rest.patch(Routes.guildMember(guild.id, '@me'), { body: parsed.body });
          done++;
        } catch {
          failed++;
        }
        await sleep(1000); // stay clear of rate limits
      }

      return ok(message, `Applied to **${done}** server(s). Failed in **${failed}**.`);
    }

    // =========================
    // SET (this server)
    // =========================
    const parsed = parseStyle(args);
    if (parsed.error) return err(message, parsed.error);

    try {
      await client.rest.patch(Routes.guildMember(message.guild.id, '@me'), { body: parsed.body });
      return ok(message, `Nameplate applied: **${args[0]}** + **${args[1]}**.`);
    } catch (e) {
      return err(message, `Couldn't apply it: \`${e.message}\``);
    }
  }
};
