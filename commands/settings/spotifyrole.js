const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();

function embed(text, color = "#D3D3D3") {
    return new EmbedBuilder().setColor(color).setDescription(`<:WarningIcon:1514708751385497721> ${text}`);
}

module.exports = {
    name: "spotifyrole",

    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply({ embeds: [embed("You don't have permission to manage roles.", "#ED4245")] });
        }

        if (args[0]?.toLowerCase() === "off") {
            await db.delete(`spotifyrole_${message.guild.id}`);
            return message.reply({ embeds: [embed("Spotify role turned off.")] });
        }

        const role = message.mentions.roles.first();
        if (!role) {
            return message.reply({ embeds: [embed("Usage: `spotifyrole @role` or `spotifyrole off`", "#ED4245")] });
        }

        if (role.position >= message.guild.members.me.roles.highest.position) {
            return message.reply({ embeds: [embed("That role is above my highest role, so I can't give it out. Move my role higher first.", "#ED4245")] });
        }

        await db.set(`spotifyrole_${message.guild.id}`, role.id);
        message.reply({ embeds: [embed(`Anyone listening to Spotify will now get ${role}.`)] });
    },
};
