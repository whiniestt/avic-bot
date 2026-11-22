const { EmbedBuilder } = require('discord.js');

const WAIFU = new Set([
  'airkiss','angrystare','bite','bonk','brofist','cuddle','handhold','hug','kiss','lick','nom','nuzzle','pat','pinch','poke','punch','slap','smack','stare','tickle','wave','bleh','blush','celebrate','cheers','clap','confused','cool','cry','dance','drool','evillaugh','facepalm','happy','headbang','huh','laugh','love','mad','nervous','no','nosebleed','nyah','peek','pout','roll','run','sad','scared','shout','shrug','shy','sigh','sing','sip','sleep','slowclap','smile','smug','sneeze','sorry','stop','surprised','sweat','thumbsup','tired','wink','yawn','yay','yes'
]);

const WAIFU_ALIASES = {
  airkiss: 'blowkiss',
  angrystare: 'angry',
  brofist: 'highfive',
  handhold: 'handholding',
  evillaugh: 'evil',
  slowclap: 'clap',
  thumbsup: 'thumbs',
  yes: 'happy',
  no: 'no',
  nosebleed: 'bleed',
  nyah: 'nya'
};

const ENDPOINTS = new Set([
  'hug','kiss','pat','poke','punch','slap','cuddle','bite','bonk',
  'lick','nom','nuzzle','tickle','wave','blush','cry','dance',
  'happy','laugh','love','no','pout','run','sad','smile','smug',
  'stare','wink','thumbs','highfive','angry','clap','bleed','nya',
  'handholding','blowkiss'
]);

const lastGifByEndpoint = new Map();

async function waifu(action) {
  const endpoint = WAIFU_ALIASES[action] || action;

  if (!ENDPOINTS.has(endpoint)) return null;

  const previousUrl = lastGifByEndpoint.get(endpoint);
  let selectedUrl = null;

  // The API is random, but retry if it returns the same image as last time.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://api.waifu.pics/sfw/${endpoint}`,
      {
        headers: {
          'User-Agent': 'FareBot/1.0'
        }
      }
    );

    if (!res.ok) continue;

    const data = await res.json();
    if (!data.url) continue;

    selectedUrl = data.url;
    if (selectedUrl !== previousUrl) break;
  }

  if (selectedUrl) lastGifByEndpoint.set(endpoint, selectedUrl);
  return selectedUrl;
}

function target(message, args) {
  return (
    message.mentions.users.first() ||
    (args.length ? args.join(' ') : null)
  );
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TITLE_OVERRIDES = {
  eightball: 'Magic 8-Ball',
  doublestruck: 'Double-Struck Text',
  emojipasta: 'Emoji Pasta',
  whowouldwin: 'Who Would Win?',
  jokeoverhead: 'Joke Overhead',
  showerthought: 'Shower Thought',
  factsmeme: 'Facts Meme'
};

function displayName(name) {
  return TITLE_OVERRIDES[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

function embed(message, title, description, image) {
  const botIcon = message.client?.user?.displayAvatarURL({ extension: 'png', size: 128 });
  const requester = message.author?.username || 'Fare user';
  const e = new EmbedBuilder()
    .setColor(0x3D4752)
    .setAuthor({ name: 'FARE • FUN', ...(botIcon ? { iconURL: botIcon } : {}) })
    .setTitle(title)
    .setDescription(String(description).slice(0, 4096))
    .setFooter({ text: `Requested by ${requester}` })
    .setTimestamp();

  if (botIcon) e.setThumbnail(botIcon);

  if (image) e.setImage(image);

  return e;
}

function reactionEmbed(message, name, targetUser, image) {
  const requester = message.member?.displayName || message.author?.globalName || message.author?.username || 'Someone';
  const requesterAvatar = message.member?.displayAvatarURL({ extension: 'png', size: 128 }) ||
    message.author?.displayAvatarURL({ extension: 'png', size: 128 });
  const targetName = typeof targetUser === 'string'
    ? targetUser
    : targetUser?.globalName || targetUser?.username || null;
  const action = displayName(name).toLowerCase();
  const line = name === 'yes'
    ? 'says yes! 🙋'
    : name === 'no'
      ? 'says no! 🙅'
      : `used ${action}${targetName ? ` on ${targetName}` : ''}!`;

  const e = new EmbedBuilder()
    .setColor(0x3D4752)
    .setAuthor({
      name: `${requester} ${line}`.slice(0, 256),
      ...(requesterAvatar ? { iconURL: requesterAvatar } : {})
    });

  if (image) e.setImage(image);
  return e;
}

function funReply(message, name, payload) {
  const normalized = typeof payload === 'string' ? { content: payload } : payload;

  if (typeof normalized?.content === 'string' && !normalized.embeds?.length) {
    return message.reply({
      embeds: [embed(message, `✨ ${displayName(name)}`, normalized.content)],
      allowedMentions: { parse: [] }
    });
  }

  return message.reply({
    ...normalized,
    allowedMentions: { parse: [] }
  });
}

const eight = [
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes — definitely.',
  'You may rely on it.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Don’t count on it.',
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.'
];

async function runFun(name, message, args) {
  const t = target(message, args);

  if (WAIFU.has(name)) {
    const url = await waifu(name).catch(() => null);

    return funReply(message, name, {
      embeds: [
        reactionEmbed(message, name, t, url)
      ]
    });
  }

  switch (name) {
    case 'eightball':
      return funReply(message, name, pick(eight));

    case 'reverse':
      return funReply(message, name,
        args.length
          ? args.join(' ').split('').reverse().join('')
          : 'Usage: `,reverse <text>`'
      );

    case 'mock':
      return funReply(message, name,
        args.length
          ? args.join(' ')
              .split('')
              .map((c, i) =>
                /[a-z]/i.test(c)
                  ? (
                      i % 2
                        ? '_' + c.toUpperCase() + '_'
                        : c.toLowerCase()
                    )
                  : c
              )
              .join('')
          : 'Usage: `,mock <text>`'
      );

    case 'doublestruck':
      return funReply(message, name,
        args.length
          ? args.join(' ')
              .split('')
              .map(c =>
                /[A-Za-z]/.test(c)
                  ? String.fromCodePoint(
                      c.toLowerCase().charCodeAt(0) +
                      0x1d400 -
                      97
                    )
                  : c
              )
              .join('')
          : 'Usage: `,doublestruck <text>`'
      );

    case 'emojipasta':
      return funReply(message, name,
        args.length
          ? args.join(' ')
              .split('')
              .map(c =>
                /[a-z]/i.test(c)
                  ? `:${c.toLowerCase()}:`
                  : c
              )
              .join('')
          : 'Usage: `,emojipasta <text>`'
      );

    case 'morse': {
      const map = {
        a: '.-',
        b: '-...',
        c: '-.-.',
        d: '-..',
        e: '.',
        f: '..-.',
        g: '--.',
        h: '....',
        i: '..',
        j: '.---',
        k: '-.-',
        l: '.-..',
        m: '--',
        n: '-.',
        o: '---',
        p: '.--.',
        q: '--.-',
        r: '.-.',
        s: '...',
        t: '-',
        u: '..-',
        v: '...-',
        w: '.--',
        x: '-..-',
        y: '-.--',
        z: '--..',
        '1': '.----',
        '2': '..---',
        '3': '...--',
        '4': '....-',
        '5': '.....',
        '6': '-....',
        '7': '--...',
        '8': '---..',
        '9': '----.',
        '0': '-----'
      };

      return funReply(message, name,
        args.length
          ? args.join(' ')
              .toLowerCase()
              .split('')
              .map(c =>
                c === ' '
                  ? '/'
                  : (map[c] || c)
              )
              .join(' ')
          : 'Usage: `,morse <text>`'
      );
    }

    case 'pickup':
      return funReply(message, name,
        pick([
          'Are you Wi-Fi? Because I’m feeling a connection.',
          'You must be a command, because you have my full attention.',
          'Are you a Discord notification? Because I can’t ignore you.'
        ])
      );

    case 'showerthought':
      return funReply(message, name,
        pick([
          'If tomatoes are a fruit, ketchup is technically a smoothie.',
          'Your future self is watching you through memories.',
          'Why do we press harder on a remote when the batteries are dying?'
        ])
      );

    case 'joke':
      return funReply(message, name,
        pick([
          'Why did the developer go broke? Because he used up all his cache.',
          'Why do programmers prefer dark mode? Because light attracts bugs.',
          'I told my bot a joke. It said: 500 Internal Server Error.'
        ])
      );

    case 'fact':
      return funReply(message, name,
        pick([
          'Honey never spoils when properly stored.',
          'Octopuses have three hearts.',
          'Bananas are botanically berries.'
        ])
      );

    case 'truth':
      return funReply(message, name,
        pick([
          'What is your most embarrassing recent moment?',
          'Who was the last person you stalked online?',
          'What is a secret you have never told your friends?'
        ])
      );

    case 'dare':
      return funReply(message, name,
        pick([
          'Send the fifth photo in your gallery.',
          'Change your status to “I love pineapple pizza” for 10 minutes.',
          'Type your next message with your eyes closed.'
        ])
      );

    case 'caption':
      return funReply(message, name,
        pick([
          'main character energy.',
          'quietly becoming better.',
          'no explanation needed.',
          'caught somewhere between chaos and calm.'
        ])
      );

    case 'quote':
      return funReply(message, name,
        pick([
          '“The secret of getting ahead is getting started.”',
          '“Success is the sum of small efforts repeated day in and day out.”',
          '“Do what you can, with what you have, where you are.”'
        ])
      );

    case 'opinion':
      return funReply(message, name,
        args.length
          ? `My completely unbiased opinion: **${args.join(' ')}** is ${pick([
              'interesting.',
              'questionable.',
              'actually pretty good.',
              'chaotic.'
            ])}.`
          : 'Usage: `,opinion <topic>`'
      );

    case 'couldread':
      return funReply(message, name,
        args.length
          ? `I could read **${args.join(' ')}** all day.`
          : 'Usage: `,couldread <text>`'
      );

    case 'alert':
      return funReply(message, name, {
        content: `🚨 ${
          args.length
            ? args.join(' ')
            : 'Alert triggered!'
        }`
      });

    case 'supreme':
      return funReply(message, name,
        pick([
          'SUPREME.',
          'Absolutely supreme.',
          'Peak behavior.'
        ])
      );

    case 'whowouldwin':
      return funReply(message, name,
        t
          ? `${message.author} vs ${
              typeof t === 'string'
                ? t
                : `<@${t.id}>`
            } — **${pick([
              'you never know.',
              '50/50.',
              'the chaos wins.'
            ])}**`
          : 'Usage: `,whowouldwin @user`'
      );

    case 'jokeoverhead':
      return funReply(message, name,
        '⚠️ Joke overhead. Please duck.'
      );

    case 'caution':
      return funReply(message, name,
        '⚠️ Proceed with caution.'
      );

    case 'gun':
      return funReply(message, name,
        '🔫 Pew pew. Keep it fictional and harmless.'
      );

    case 'drip':
      return funReply(message, name,
        `${t
          ? (
              typeof t === 'string'
                ? t
                : `<@${t.id}>`
            )
          : message.author} has been inspected for drip. 💧`
      );

    case 'blur':
      return funReply(message, name,
        '🫥 Blur filter activated — imagine everything slightly out of focus.'
      );

    case 'invert':
      return funReply(message, name,
        '🔄 Invert filter activated.'
      );

    case 'greyscale':
      return funReply(message, name,
        '⬛ Greyscale filter activated.'
      );

    case 'advertise':
      return funReply(message, name,
        '📢 Fare — Minimal. Powerful. Built for modern Discord communities.'
      );

    case 'mnm':
      return funReply(message, name,
        '🍫 M&M mode: enabled.'
      );

    case 'clown':
      return funReply(message, name,
        `${t
          ? (
              typeof t === 'string'
                ? t
                : `<@${t.id}>`
            )
          : message.author} 🤡 certified clown.`
      );

    case 'jailed':
      return funReply(message, name,
        `${t
          ? (
              typeof t === 'string'
                ? t
                : `<@${t.id}>`
            )
          : message.author} has been sent to the meme jail. 🔒`
      );

    case 'wanted':
      return funReply(message, name,
        `🚨 WANTED: ${
          t
            ? (
                typeof t === 'string'
                  ? t
                  : `<@${t.id}>`
              )
            : message.author
        }`
      );

    case 'pet':
      return funReply(message, name,
        `🐾 ${message.author} pets ${
          t
            ? (
                typeof t === 'string'
                  ? t
                  : `<@${t.id}>`
              )
            : 'the air'
        }.`
      );

    case 'nokia':
      return funReply(message, name,
        '📱 Nokia durability test: **passed.**'
      );

    case 'uncover':
      return funReply(message, name,
        '🕵️ Something was uncovered. Unfortunately, it was another Discord message.'
      );

    case 'huerotate':
      return funReply(message, name,
        '🌈 Hue rotated successfully.'
      );

    case 'colorify':
      return funReply(message, name,
        '🌈 Colorify activated.'
      );

    case 'cat': {
      const r = await fetch(
        'https://cataas.com/cat?json=true'
      ).catch(() => null);

      const d =
        r && r.ok
          ? await r.json().catch(() => null)
          : null;

      return funReply(message, name, {
        embeds: [
          embed(
            message,
            '🐱 Cat',
            'Here is your cat.',
            d?.url || 'https://cataas.com/cat'
          )
        ]
      });
    }

    case 'hack':
      return funReply(message, name,
        `💻 Hacking ${
          t
            ? (
                typeof t === 'string'
                  ? t
                  : `<@${t.id}>`
              )
            : 'the mainframe'
        }...\n${pick([
          '[██████████] 100%',
          'Access denied 😭',
          'Totally hacked. Trust me.'
        ])}`
      );

    case 'token':
      return funReply(message, name,
        '🔐 Nice try. Fare will never expose Discord tokens or secrets.'
      );

    case 'biden':
      return funReply(message, name,
        '🇺🇸 Meme command executed.'
      );

    case 'pikachu':
      return funReply(message, name,
        '⚡ Pika pika!'
      );

    case 'oogway':
      return funReply(message, name,
        '🐢 There are no accidents.'
      );

    case 'drake':
      return funReply(message, name,
        '🙅 Drake says no.\n👉 Drake says yes.'
      );

    case 'pooh':
      return funReply(message, name,
        '🍯 Pooh approves.'
      );

    case 'sadcat':
      return funReply(message, name,
        '😿 *sad cat noises*'
      );

    case 'factsmeme':
      return funReply(message, name,
        '📚 FACTS: you are currently using Fare.'
      );

    case 'unforgivable':
      return funReply(message, name,
        '🚫 That was unforgivable.'
      );

    case 'cool':
      return funReply(message, name,
        '😎 Cool detected.'
      );

    default:
      return funReply(message, name,
        'Fun command executed!'
      );
  }
}

module.exports = { runFun };
