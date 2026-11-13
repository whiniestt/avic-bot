process.on("unhandledRejection", (err) => {
    console.error("========== UNHANDLED REJECTION ==========");
    console.error(err);
    console.error(err?.stack);
});

process.on("uncaughtException", (err) => {
    console.error("========== UNCAUGHT EXCEPTION ==========");
    console.error(err);
    console.error(err?.stack);
});

console.log("Node Version:", process.version);

const {
    Client,
    GatewayIntentBits,
    Collection,
    EmbedBuilder
} = require("discord.js");

const http = require("http");

const fs = require("fs");
const path = require("path");

const { QuickDB } = require("quick.db");
const db = new QuickDB();

setInterval(() => {
    const mem = process.memoryUsage();

    console.log(
        "RAM:",
        Math.round(mem.rss / 1024 / 1024) + "MB"
    );
}, 60000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ],

    allowedMentions: {
        repliedUser: false
    }
});

// ======================
// WEBSITE STATS API
// ======================

http.createServer((req, res) => {

    const url = new URL(
        req.url,
        `http://${req.headers.host}`
    );

    // ----------------------
    // SERVER LIST
    // ----------------------

    if (url.pathname === "/api/servers") {

        const servers = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({
                extension: "png",
                size: 128
            }),
            members: guild.memberCount || 0
        }));

        res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
        });

        return res.end(JSON.stringify({
            success: true,
            count: servers.length,
            servers
        }));
    }

    // ----------------------
    // WEBSITE STATS
    // ----------------------

    if (url.pathname === "/stats") {

        res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
        });

        return res.end(JSON.stringify({
            servers: client.guilds.cache.size,

            users: client.guilds.cache.reduce(
                (total, guild) =>
                    total + (guild.memberCount || 0),
                0
            ),

            commands: client.commands.size,

            ping: client.ws.ping
        }));
    }

    // ----------------------
    // RAILWAY HEALTH CHECK
    // ----------------------

    if (url.pathname === "/") {

        res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        });

        return res.end(JSON.stringify({
            success: true,
            bot: "Fare",
            status: "online"
        }));
    }

    // ----------------------
    // NOT FOUND
    // ----------------------

    res.writeHead(404, {
        "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
        success: false,
        error: "Not found"
    }));

}).listen(process.env.PORT || 3000);

client.commands = new Collection();
const cooldowns = new Collection();

// =========================
// SLASH COMMAND LOADER
// =========================

client.slashCommands = new Collection();

const slashPath = path.join(__dirname, "commands", "slash");

if (fs.existsSync(slashPath)) {
    const slashFiles = fs.readdirSync(slashPath)
        .filter(file => file.endsWith(".js"));

    for (const file of slashFiles) {
        const command = require(path.join(slashPath, file));

        client.slashCommands.set(command.data.name, command);
    }
}

// =========================
// SLASH COMMAND HANDLER
// =========================

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(
        interaction.commandName
    );

    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error("SLASH COMMAND ERROR:", error);

        const reply = {
            content: "❌ Something went wrong while executing this command.",
            ephemeral: true
        };

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(reply).catch(() => {});
        } else {
            await interaction.reply(reply).catch(() => {});
        }
    }
});

// =========================
// EVENT LOADER
// =========================

const eventPath = path.join(__dirname, "events");

const eventFiles = fs
    .readdirSync(eventPath)
    .filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
    if (["lavalink.js", "musicButtons.js", "musicPanel.js"].includes(file)) continue;

    const filePath = path.join(eventPath, file);
    const event = require(filePath);

    if (typeof event === "function") {
        event(client);
    }
}

const DEFAULT_PREFIX = ",";

// =========================
// COMMAND LOADER
// =========================

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    if (folder === "music") continue;

    const commandsPath = path.join(foldersPath, folder);

    if (!fs.statSync(commandsPath).isDirectory()) continue;

    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if (command.name) {
            client.commands.set(command.name, command);

            if (Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    client.commands.set(alias, command);
                }
            }
        }
    }
}

// =========================
// BOT READY
// =========================

client.once("clientReady", () => {
    console.log(`🤖 Fare Bot logged in as ${client.user.tag}`);

    require("./events/giveawayManager")(client);

    // =========================
    // SINGLE FARE STATUS
    // =========================

    const updateStatus = () => {
        const users = client.guilds.cache.reduce(
            (total, guild) => total + guild.memberCount,
            0
        );

        client.user.setPresence({
            status: "dnd",
            activities: [
                {
                    name: `${users} users on Fare Waves`,
                    type: 3
                }
            ]
        });
    };

    updateStatus();

    // =========================
    // MESSAGE CREATE
    // =========================

    client.on("messageCreate", async (message) => {
        // =========================
        // REMOVE GLOBAL AFK
        // =========================

        const globalAfk = await db.get(
            `afk_${message.author.id}`
        );

        if (globalAfk) {
            await db.delete(
                `afk_${message.author.id}`
            );

            message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#57F287")
                        .setThumbnail(
                            message.author.displayAvatarURL({
                                dynamic: true
                            })
                        )
                        .setDescription(
                            `<:Tick:1514714190500335677> Welcome back ${message.author} from Global AFK\n\n` +
                            `<:arrow:1514699753462566953> You have been AFK since <t:${Math.floor(globalAfk.since / 1000)}:R>\n` +
                            `<:info:1514699288674828310> Reason • ${globalAfk.reason}\n` +
                            `<:dot:1514706694079254730> Mentions • **${globalAfk.mentions || 0}**`
                        )
                ]
            });
        }

        // =========================
        // REMOVE SERVER AFK
        // =========================

        if (message.guild) {
            const serverAfk = await db.get(
                `afk_${message.guild.id}_${message.author.id}`
            );

            if (serverAfk) {
                await db.delete(
                    `afk_${message.guild.id}_${message.author.id}`
                );

                message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#A9C7FF")
                            .setThumbnail(
                                message.author.displayAvatarURL({
                                    dynamic: true
                                })
                            )
                            .setDescription(
                                `<:Tick:1514714190500335677> Welcome back ${message.author} from Server AFK\n\n` +
                                `<:arrow:1514699753462566953> You have been AFK since <t:${Math.floor(serverAfk.since / 1000)}:R>\n` +
                                `<:info:1514699288674828310> Reason • ${serverAfk.reason}\n` +
                                `<:dot:1514706694079254730> Mentions • **${serverAfk.mentions || 0}**`
                            )
                    ]
                });
            }
        }

        // =========================
        // AFK MENTION SYSTEM
        // =========================

        if (message.guild) {
            for (const user of message.mentions.users.values()) {
                const globalKey = `afk_${user.id}`;
                const serverKey = `afk_${message.guild.id}_${user.id}`;

                let data = await db.get(globalKey);
                let key = globalKey;

                if (!data) {
                    data = await db.get(serverKey);
                    key = serverKey;
                }

                if (!data) continue;

                data.mentions = (data.mentions || 0) + 1;

                await db.set(key, data);

                message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FFCC66")
                            .setThumbnail(
                                user.displayAvatarURL({
                                    dynamic: true
                                })
                            )
                            .setDescription(
                                `<:WarningIcon:1514708751385497721> **${user.username} is currently AFK**\n\n` +
                                `<:arrow:1514699753462566953> Reason • ${data.reason}\n` +
                                `<:timerr:1514699712681218094> Since • <t:${Math.floor(data.since / 1000)}:R>`
                            )
                    ]
                });
            }
        }

        // =========================
        // IGNORE BOT MESSAGES
        // =========================

        if (message.author.bot) return;

        // =========================
        // STATS
        // =========================

        await db.add(
            `stats.${message.author.id}.messages`,
            1
        );

        await db.add(
            `stats.${message.author.id}.xp`,
            5
        );

        // =========================
        // AI REPLY SYSTEM
        // =========================

        if (message.reference) {
            try {
                const replied = await message.channel.messages.fetch(
                    message.reference.messageId
                );

                const isAiMessage =
                    replied.reactions.cache.some(
                        r => r.emoji.id === "1514699727072133233"
                    );

                if (isAiMessage) {
                    const aiCommand = client.commands.get("ai");

                    if (aiCommand) {
                        return aiCommand.execute(
                            message,
                            message.content.split(" ")
                        );
                    }
                }
            } catch (err) {
                console.log(
                    "AI CHECK ERROR:",
                    err?.message || String(err)
                );
            }
        }

        if (message.author.bot) return;

        // =========================
        // CHAT STORAGE
        // =========================

        await db.push(
            `chat_${message.author.id}`,
            message.content
        );

        // =========================
        // GLOBAL AFK CHECK
        // =========================

        const afkData = await db.get(
            `afk_${message.author.id}`
        );

        if (afkData) {
            await db.delete(
                `afk_${message.author.id}`
            );

            message
                .reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#D3D3D3")
                            .setDescription(
                                `<:Tick:1514714190500335677> Welcome back ${message.author}`
                            )
                    ]
                })
                .then(m => {
                    setTimeout(() => {
                        m.delete().catch(() => {});
                    }, 5000);
                });
        }

        // =========================
        // BOT MENTION / PREFIX INFO
        // =========================

        if (
            message.content === `<@${client.user.id}>` ||
            message.content === `<@!${client.user.id}>`
        ) {
            const embed = new EmbedBuilder()
                .setColor("#D3D3D3")
                .setTitle("<:bot1:1514699532686852227> | Prefix Info")
                .setDescription(
                    `<:dot:1514706694079254730> Prefix Help
Hey ${message.author}! Here are my current prefixes:

<:dot:1514706694079254730> Details

> <:arrow:1514699753462566953> Global Prefix : \`,\`
> <:arrow:1514699753462566953> Server Prefix : \`,\`

> Tip: Use \`,help\` to see all my commands.`
                );

            const pingMsg = await message.reply({
                embeds: [embed]
            });

            setTimeout(() => {
                pingMsg.delete().catch(() => {});
            }, 15000);

            return;
        }

        // =========================
        // NO PREFIX
        // =========================

        const isNoPrefix =
            message.author.id === "1530872106399567941" ||
            await db.get(
                `noprefix_${message.author.id}`
            );

        let args;
        let commandName;

        const savedPrefixes = message.guild
    ? await db.get(`server_prefixes_${message.guild.id}`)
    : [];

const customPrefixes = Array.isArray(savedPrefixes)
    ? savedPrefixes.filter(prefix => typeof prefix === 'string' && prefix.length > 0)
    : [];

const activePrefixes = customPrefixes.length
    ? customPrefixes
    : [DEFAULT_PREFIX];

const prefixesToCheck = [...activePrefixes]
    .sort((a, b) => b.length - a.length);

const matchedPrefix = prefixesToCheck.find(prefix =>
    message.content.startsWith(prefix)
);

if (matchedPrefix) {
    args = message.content
        .slice(matchedPrefix.length)
        .trim()
        .split(/ +/);

    commandName = (args.shift() || '').toLowerCase();
} else if (isNoPrefix) {
    args = message.content
        .trim()
        .split(/ +/);

    commandName = (args.shift() || '').toLowerCase();
} else {
    return;
    }

        // =========================
        // FIND COMMAND
        // =========================

        const command = client.commands.get(commandName);

        if (!command) return;

        // =========================
        // COOLDOWN
        // =========================

        const cooldown = 5000;

        if (!cooldowns.has(command.name)) {
            cooldowns.set(
                command.name,
                new Collection()
            );
        }

        const now = Date.now();
        const timestamps = cooldowns.get(command.name);

        if (timestamps.has(message.author.id)) {
            const expirationTime =
                timestamps.get(message.author.id) + cooldown;

            if (now < expirationTime) {
                const timeLeft =
                    ((expirationTime - now) / 1000).toFixed(2);

                const cooldownEmbed = new EmbedBuilder()
                    .setColor("#FF7F7F")
                    .setTitle("You can't use this command!")
                    .setDescription(
                        `<a:spider_cross:1514728338701287640> You are under cooldown to this command!

<:arrow:1514699753462566953> Cooldown ~ \`${timeLeft} s\``
                    );

                const msg = await message.reply({
                    embeds: [cooldownEmbed]
                });

                setTimeout(() => {
                    msg.delete().catch(() => {});
                }, 10000);

                return;
            }
        }

        timestamps.set(
            message.author.id,
            now
        );

        setTimeout(() => {
            timestamps.delete(message.author.id);
        }, cooldown);

        // =========================
        // EXECUTE COMMAND
        // =========================

        try {
            await command.execute(
                message,
                args,
                client
            );
        } catch (err) {
            console.error(
                "COMMAND ERROR:",
                err?.message || String(err)
            );

            message.reply(
                "<:WarningIcon:1514708751385497721> **__Error running command!__**"
            );
        }
    });
});


// =========================
// REGISTER SLASH COMMANDS
// =========================

client.once("clientReady", async () => {
    try {
        const guildId = process.env.GUILD_ID;

        const existing = await client.application.commands.fetch(
            guildId ? { guildId } : {}
        );

        const commands = [
            ...existing
                .filter(command => command.name !== "react")
                .map(command => command.toJSON()),

            ...client.slashCommands.map(command =>
                command.data.toJSON()
            )
        ];

        await client.application.commands.set(
            commands,
            guildId
        );

        console.log("✅ Slash commands registered successfully.");
    } catch (error) {
        console.error("❌ Slash registration error:", error);
    }
});


// =========================
// LOGIN
// =========================

client
    .login(process.env.TOKEN)
    .then(() => {
        console.log("✅ Discord login successful");
    })
    .catch((err) => {
        console.error(
            "❌ DISCORD LOGIN ERROR:",
            err?.message || String(err)
        );
    });
