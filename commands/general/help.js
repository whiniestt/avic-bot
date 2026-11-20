const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const db = require('../../database');

const cooldown = new Set();
const DEFAULT_PREFIX = ',';

const BANNER_URL = 'https://cdn.discordapp.com/attachments/1535172200951316500/1543492999626104852/banner.jpg?ex=6a95115f&is=6a93bfdf&hm=6a1c42a3b2edb9bcbd6ec1cf79ef42f58f75756dc159206c65465a18a662f668&';
const OWNER_ID = '1530872106399567941';
const SUPPORT_URL = 'https://discord.gg/46Vn9pdtPF';
const WEBSITE_URL = 'https://farewaves.vercel.app/';
const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1514506916993306744&permissions=8&integration_type=0&scope=bot+applications.commands';

// Stops the owner @mention in the help text from pinging them every time
const NO_PINGS = { parse: [], repliedUser: false };
const V2 = MessageFlags.IsComponentsV2;

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const L = (s) => s.split('|');

// =========================
// MODULES
// key / label / d (select description) / e (emoji) / title / sections [heading, commands]
// =========================
const CATEGORIES = [
  {
    key: 'general', label: 'General', d: 'general', e: '<:member1:1514699741282304061>', title: 'General',
    sections: [
      ['Basic Commands', L('afk|membercount|boostcount|joinedat|serverinfo|userinfo|channelinfo|roleinfo|avatar|banner|servericon|serverbanner|profile|vote')],
      ['Bot Information', L('invite|stats|botinfo|ping|uptime|users|documentation|website|variables|purchase')],
      ['List Commands', L('list|list bots|list admins|list mods|list roles|list inrole|list early|list createdat|list bans|list invoice|list activedeveloper|list bughunters|list hypesquad|list pending|list channels|list users|list timeouts|list joinedat|list hasperms|list boosters|list emojis')]
    ]
  },
  {
    key: 'security', label: 'Security', d: 'security', e: '<:shield:1514699900225323108>', title: 'Security Modules',
    sections: [
      ['Antinuke', L('antinuke|antinuke disable|antinuke logging|antinuke autorecovery|antinuke whitelist|antinuke manage|antinuke betrayalguard|antinuke enable|antinuke whitelisted|antinuke limit|antinuke owneronly|antinuke config|antinuke wizard')],
      ['Mainrole', L('mainrole|mainrole remove|mainrole add|mainrole show|mainrole reset')],
      ['Panicmode', L('panicmode|panicmode enable|panicmode reset|panicmode setup|panicmode deactivate|panicmode activate|panicmode disable|panicmode show')]
    ]
  },
  {
    key: 'automod', label: 'Automod', d: 'automod', e: '<:shield:1514699907103985664>', title: 'Automod',
    sections: [
      ['Automod', L('automod|automod reset|automod settings|automod whitelist|automod disable|automod enable|automod wlshow|automod logging|automod manage')],
      ['Word Blacklist', L('blword|blword reset|blword add|blword remove|blword show|blword guide')]
    ]
  },
  {
    key: 'moderation', label: 'Moderation', d: 'moderation', e: '<:mod1:1514699913919991839>', title: 'Moderation',
    sections: [
      ['Basic Commands', L('ban|softban|kick|mute|unmute|unban|nick|clone|nuke|hideall|unhideall|lockall|unlockall|unbanall|lock|unlock|hide|unhide|slowmode|unslowmode|channel|channel create|channel deleteafter|channel rename|channel transfer|channel delete|enlarge|steal|deleteemoji|deletesticker|snipe')],
      ['Role Commands', L('role|role delete|role remove|role icon|role add|role bots|role colour|role taskcancel|role rename|role all|role create|role humans|rrole|rrole bots|rrole humans|rrole all')],
      ['Purge Commands', L('clear|clear user|clear bots|clear image|clear reactions|clear contain|clear embed|clear all|clear emoji|clear files|clear mentions|purgeuser|purgebots')],
      ['Quarantine Commands', L('quarantine|quarantine show|quarantine config|quarantine add|quarantine setup|quarantine remove|quarantine reset|unquarantine')]
    ]
  },
  {
    key: 'embedsystem', label: 'Embed System', d: 'embed', e: '<:embed:1514699282152685759>', title: 'Embed System',
    sections: [
      ['Embed Commands', L('embed|embed save|embed edit|embed create|embed import|embed export|embed send|embed rename|embed delete|embed show')],
      ['Variable Command', L('variables [module] [category]')]
    ]
  },
  {
    key: 'utility', label: 'Utility', d: 'utility', e: '<:utility:1514699921914331136>', title: 'Utility',
    sections: [
      ['Media Commands', L('media|media show|media add|media reset|media bypass|media bypass remove|media bypass add|media bypass reset|media bypass show|media remove')],
      ['Reaction Role', L('reactionrole|reactionrole remove|reactionrole add|reactionrole format|reactionrole addmany|reactionrole maxroles|reactionrole edit|reactionrole clear|reactionrole show|reactionrole clone|reactionrole info')]
    ]
  },
  {
    key: 'autoresponders', label: 'Autoresponders', d: 'autoresponder', e: '<:autoresponder:1514699559094190220>', title: 'Autoresponders',
    sections: [
      ['Auto Responders', L('autoresponder|autoresponder reset|autoresponder add|autoresponder editreply|autoresponder remove|autoresponder rename|autoresponder show')],
      ['Auto Reactors', L('autoreact|autoreact reset|autoreact rename|autoreact remove|autoreact editemojis|autoreact add|autoreact show')]
    ]
  },
  {
    key: 'timer', label: 'Timer', d: 'timer', e: '<:timer:1514699712681218094>', title: 'Timer',
    sections: [['Timer', L('tstart|tpause|tresume|tend')]]
  },
  {
    key: 'giveaway', label: 'Giveaway', d: 'giveaway', e: '<:gwy3:1514705349859606548>', title: 'Giveaway',
    sections: [['Giveaways', L('gcreate|gend|greroll|glist|gdelete')]]
  },
  {
    key: 'music', label: 'Music', d: 'music', e: '<:music:1514699942181081261>', title: 'Music',
    sections: [
      ['Music Commands', L('play|nowplaying|autoplay|history|queue|lavalink|join|leave|forcefix|pause|resume|volume|replay|seek|forward|rewind|loop|247|shuffle|clearqueue|remove|move|skip|skipinto|lyrics')],
      ['Filter Commands', L('filter|filter toggle|filter reset')]
    ]
  },
  {
    key: 'funcommands', label: 'Fun Commands', d: 'fun', e: '<:fun:1514699948480790608>', title: 'Fun Commands',
    sections: [
      ['Fun Commands', L('airkiss|angrystare|bite|bonk|brofist|cuddle|handhold|hug|kiss|lick|nom|nuzzle|pat|pinch|poke|punch|slap|smack|stare|tickle|wave|bleh|blush|celebrate|cheers|clap|confused|cool|cry|dance|drool|evillaugh|facepalm|happy|headbang|huh|laugh|love|mad|nervous|no|nosebleed|nyah|peek|pout|roll|run|sad|scared|shout|shrug|shy|sigh|sing|sip|sleep|slowclap|smile|smug|sneeze|sorry|stop|surprised|sweat|thumbsup|tired|wink|yawn|yay|yes')],
      [null, L('eightball|reverse|mock|doublestruck|emojipasta|morse|biden|pikachu|oogway|drake|pooh|sadcat|factsmeme|unforgivable|caution|opinion|gun|drip|blur|invert|greyscale|advertise|mnm|pickup|showerthought|clown|jailed|wanted|pet|alert|supreme|whowouldwin|nokia|uncover|jokeoverhead|huerotate|quote|couldread|caption|colorify|cat|joke|fact|truth|dare|hack|token')]
    ]
  },
  {
    key: 'sticky', label: 'Sticky', d: 'sticky', e: '<:sticky:1514699935264673902>', title: 'Sticky',
    sections: [['Sticky Message', L('sticky|sticky show|sticky channel|sticky channel remove|sticky channel add|sticky remove|sticky bump|sticky reset|sticky add')]]
  },
  {
    key: 'tickets', label: 'Tickets', d: 'ticket', e: '<:ticket:1514699959847616573>', title: 'Ticket Commands',
    sections: [['Ticket Commands', L('ticket|ticket transcript|ticket delete|ticket add|ticket greetmsg|ticket maxtickets|ticket remove|ticket autotranscript|ticket category|ticket logging|ticket rename|ticket reopen|ticket list|ticket support|ticket support reset|ticket support remove|ticket support show|ticket support add|ticket panel|ticket type|ticket type create|ticket type delete|ticket type edit|ticket close')]]
  },
  {
    key: 'logging', label: 'Logging', d: 'logging', e: '<:logging:1514708745756872845>', title: 'Logging Commands',
    sections: [['Logging Commands', L('logging|logging setup|logging setup channel|logging setup auto|logging setup clear|logging disable|logging enable|logging wizard|logging config|logging remove|logging ignore|logging ignore remove|logging ignore add|logging ignore voice|logging ignore embed')]]
  },
  {
    key: 'voicecommands', label: 'Voice Commands', d: 'voice', e: '<:voice:1514699954264998041>', title: 'Voice Commands',
    sections: [
      ['Voice Commands', L('voice|voice unlock|voice mute|voice unprivate|voice undeafenall|voice deafen|voice muteall|voice moveall|voice pullall|voice private|voice deafenall|voice move|voice unmute|voice kick|voice lock|voice kickall|voice unmuteall|voice pull|voice undeafen')],
      ['VC Roles', L('vcrole|vcrole set|vcrole disable|vcrole enable|vcrole show|vcrole reset')]
    ]
  },
  {
    key: 'botsettings', label: 'Bot Settings', d: 'bot settings', e: '<:bot1:1514699532686852227>', title: 'Bot Settings',
    sections: [
      ['Profile', L('profile|profileedit')],
      ['Branding', L('customize|customize bio|customize avatar|customize banner|customize sync|customize reset|customize nick')],
      ['Prefix', L('prefix|prefix show|prefix set|prefix add|prefix reset|prefix remove')]
    ]
  },
  {
    key: 'invitetracker', label: 'Invite Tracker', d: 'invite tracker', e: '<:invite:1514699307754721491>', title: 'Invite Tracker',
    sections: [
      ['Invite Commands', L('invites|invite|inviter|invites leaderboard|invites info')],
      ['Management', L('invites reset|invites add|invites remove|invites fake')],
      ['Tracking', L('invites joins|invites leaves')],
      ['Configuration', L('invites setup|invites config')]
    ]
  },
  {
    key: 'ai', label: 'AI', d: 'AI', e: '<:ai:1514699727072133233>', title: 'AI',
    sections: [['AI', L('ai')]]
  },
  {
    key: 'premium', label: 'Premium', d: 'premium', e: '<:premium:1514699759250575472>', title: 'Premium',
    sections: [['Premium', L('premium')]]
  }
];

module.exports = {
  name: 'help',

  async execute(message, args, client) {

    // =========================
    // COOLDOWN
    // =========================
    if (cooldown.has(message.author.id)) {
      const cooldownMsg = await message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF7F7F)
            .addTextDisplayComponents(
              text(
`<:WarningIcon:1514708751385497721> You are under cooldown to this command!

<:arrow:1514699753462566953> Cooldown ~ \`5s\``
              )
            )
        ],
        flags: V2,
        allowedMentions: NO_PINGS
      });

      setTimeout(() => cooldownMsg.delete().catch(() => {}), 2000);
      return;
    }

    cooldown.add(message.author.id);
    setTimeout(() => cooldown.delete(message.author.id), 5000);

    // =========================
    // PREFIX DISPLAY
    // =========================
    const savedServerPrefixes = message.guild
      ? await db.get(`server_prefixes_${message.guild.id}`)
      : null;

    const activeServerPrefixes =
      Array.isArray(savedServerPrefixes) && savedServerPrefixes.length > 0
        ? savedServerPrefixes
        : [DEFAULT_PREFIX];

    const usedPrefix = [...activeServerPrefixes]
      .sort((a, b) => b.length - a.length)
      .find((prefix) => message.content.startsWith(prefix));

    const prefixDisplay = usedPrefix ? `\`${usedPrefix}\`` : '`No prefix required`';

    // =========================
    // HOME CONTAINER
    // =========================
    const buildHome = (disabled = false) => {

      const select = new StringSelectMenuBuilder()
        .setCustomId('help_menu')
        .setPlaceholder('⤷Select a module to see')
        .setDisabled(disabled)
        .addOptions(
          CATEGORIES.map((c) => ({
            label: c.label,
            description: `View ${c.d} commands`,
            value: c.key,
            emoji: { id: c.e.match(/:(\d+)>/)[1] }
          }))
        );

      const links = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Support').setStyle(ButtonStyle.Link).setURL(SUPPORT_URL),
        new ButtonBuilder().setLabel('Website').setStyle(ButtonStyle.Link).setURL(WEBSITE_URL)
      );

      return new ContainerBuilder()
        .addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(BANNER_URL))
        )
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              text('## Fare Help'),
              text('-# Experience the ultimate Discord bot designed for seamless management and community engagement.')
            )
            .setThumbnailAccessory(
              new ThumbnailBuilder().setURL(client.user.displayAvatarURL({ size: 256 }))
            )
        )
        .addSeparatorComponents(divider())
        .addTextDisplayComponents(
          text(
`<:slash:1514699274917511248> **Prefix:** ${prefixDisplay}
<:dev:1514699929199706143> **Commands:** \`${client.commands.size}\`
<:general:1514699942181081261> **Modules:** \`${CATEGORIES.length}\`
<:crown:1514699539657920592> **Bot Owner:** <@${OWNER_ID}>

-# **Thanks for using [Fare](${INVITE_URL})!**`
          )
        )
        .addSeparatorComponents(divider())
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(select),
          links
        )
        .addTextDisplayComponents(text(`-# Command Executed by ${message.author.username}`));
    };

    // =========================
    // LOADING MESSAGE
    // =========================
    const loadingMsg = await message.reply({
      components: [
        new ContainerBuilder().addTextDisplayComponents(
          text('<a:clockk:1514734530282520647> **Just A Moment.**')
        )
      ],
      flags: V2,
      allowedMentions: NO_PINGS
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await loadingMsg.edit({
      components: [buildHome()],
      flags: V2,
      allowedMentions: NO_PINGS
    });

    // =========================
    // COLLECTOR
    // =========================
    const collector = loadingMsg.createMessageComponentCollector({
      filter: (i) => i.customId === 'help_menu',
      time: 300000
    });

    collector.on('collect', async (interaction) => {

      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xFF7F7F)
              .addTextDisplayComponents(
                text("<a:spider_cross:1514728338701287640> This help menu isn't yours.")
              )
          ],
          flags: V2 | MessageFlags.Ephemeral
        });
      }

      const cat = CATEGORIES.find((c) => c.key === interaction.values[0]);

      if (!cat) {
        return interaction.reply({
          components: [new ContainerBuilder().addTextDisplayComponents(text('Category under development.'))],
          flags: V2 | MessageFlags.Ephemeral
        });
      }

      const body = cat.sections
        .map(([heading, cmds]) =>
          (heading ? `**__${heading}__**\n` : '') + cmds.map((c) => `\`${c}\``).join(' , ')
        )
        .join('\n\n');

      return interaction.reply({
        components: [
          new ContainerBuilder()
            .addTextDisplayComponents(text(`### ${cat.e} ${cat.title}`))
            .addSeparatorComponents(divider())
            .addTextDisplayComponents(text(body))
            .addTextDisplayComponents(text(`-# Executed by ${message.author.username}`))
        ],
        flags: V2 | MessageFlags.Ephemeral
      });
    });

    // Disable the dropdown once the menu expires
    collector.on('end', () => {
      loadingMsg.edit({
        components: [buildHome(true)],
        flags: V2,
        allowedMentions: NO_PINGS
      }).catch(() => {});
    });
  }
};
