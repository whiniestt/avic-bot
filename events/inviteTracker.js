const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");

module.exports = (client) => {

    client.inviteCaches = new Map();

    async function cacheGuildInvites(guild) {
        try {
            const invites = await guild.invites.fetch();
            const codeMap = new Map();
            invites.forEach((inv) => codeMap.set(inv.code, inv.uses || 0));
            client.inviteCaches.set(guild.id, codeMap);
        } catch (err) {
            console.error(`Failed to cache invites for ${guild.name}:`, err?.message || String(err));
        }
    }

    client.once("clientReady", async () => {
        for (const guild of client.guilds.cache.values()) {
            await cacheGuildInvites(guild);
        }
    });

    client.on("guildCreate", (guild) => cacheGuildInvites(guild));

    client.on("inviteCreate", (invite) => {
        const cache = client.inviteCaches.get(invite.guild.id) || new Map();
        cache.set(invite.code, invite.uses || 0);
        client.inviteCaches.set(invite.guild.id, cache);
    });

    client.on("inviteDelete", (invite) => {
        const cache = client.inviteCaches.get(invite.guild.id);
        if (cache) cache.delete(invite.code);
    });

    client.on("guildMemberAdd", async (member) => {
        try {
            const guild = member.guild;
            const oldCache = client.inviteCaches.get(guild.id) || new Map();
            const newInvites = await guild.invites.fetch().catch(() => null);

            let usedInvite = null;

            if (newInvites) {
                for (const invite of newInvites.values()) {
                    const oldUses = oldCache.get(invite.code) || 0;
                    if (invite.uses > oldUses) {
                        usedInvite = invite;
                        break;
                    }
                }
                const codeMap = new Map();
                newInvites.forEach((inv) => codeMap.set(inv.code, inv.uses || 0));
                client.inviteCaches.set(guild.id, codeMap);
            }

            const config = await db.get(`inviteconfig_${guild.id}`);
            const logChannel = config?.channelId ? guild.channels.cache.get(config.channelId) : null;

            if (usedInvite && usedInvite.inviter) {
                const inviterId = usedInvite.inviter.id;

                await db.add(`invites_${guild.id}_${inviterId}.regular`, 1);
                await db.set(`invitedby_${guild.id}_${member.id}`, inviterId);
                await db.push(`invitedlist_${guild.id}_${inviterId}`, member.id);

                if (logChannel) {
                    const data = (await db.get(`invites_${guild.id}_${inviterId}`)) || {};
                    const total = (data.regular || 0) + (data.bonus || 0) - (data.left || 0) - (data.fake || 0);

                    logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#D3D3D3")
                                .setDescription(
                                    `<:arrow:1514699753462566953> ${member} joined using **${usedInvite.code}** from <@${inviterId}>\n` +
                                    `<:info:1514699288674828310> <@${inviterId}> now has **${total}** invite(s)`
                                ),
                        ],
                    });
                }
            } else if (logChannel) {
                logChannel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#D3D3D3")
                            .setDescription(`<:arrow:1514699753462566953> ${member} joined — couldn't determine invite (vanity URL, invite deleted, or bot added them).`),
                    ],
                });
            }
        } catch (err) {
            console.error("INVITE TRACK ERROR:", err?.message || String(err));
        }
    });

    client.on("guildMemberRemove", async (member) => {
        try {
            const guild = member.guild;
            const inviterId = await db.get(`invitedby_${guild.id}_${member.id}`);

            if (inviterId) {
                await db.add(`invites_${guild.id}_${inviterId}.left`, 1);

                const config = await db.get(`inviteconfig_${guild.id}`);
                const logChannel = config?.channelId ? guild.channels.cache.get(config.channelId) : null;

                if (logChannel) {
                    logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#ED4245")
                                .setDescription(`<:arrow:1514699753462566953> ${member.user.tag} left — was invited by <@${inviterId}>`),
                        ],
                    });
                }
            }
        } catch (err) {
            console.error("INVITE LEAVE TRACK ERROR:", err?.message || String(err));
        }
    });
};
