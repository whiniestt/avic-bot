const { ActivityType } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");

module.exports = (client) => {
    client.on("presenceUpdate", async (oldPresence, newPresence) => {
        try {
            const member = newPresence?.member;
            if (!member || member.user.bot) return;

            const roleId = await db.get(`spotifyrole_${member.guild.id}`);
            if (!roleId) return;

            const role = member.guild.roles.cache.get(roleId);
            if (!role) return;

            const listening = newPresence.activities.some(
                (a) => a.type === ActivityType.Listening && a.name === "Spotify"
            );
            const hasRole = member.roles.cache.has(roleId);

            if (listening && !hasRole) {
                await member.roles.add(role, "Listening to Spotify");
            } else if (!listening && hasRole) {
                await member.roles.remove(role, "Stopped listening to Spotify");
            }
        } catch (err) {
            console.error("SPOTIFY ROLE ERROR:", err?.message || String(err));
        }
    });
};
