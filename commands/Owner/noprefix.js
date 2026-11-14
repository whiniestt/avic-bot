const { EmbedBuilder } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = require(process.cwd() + "/database");

const OWNER_IDS = [
    "1306606920836055043",
    "1530872106399567941"
];
module.exports = {
    name: "noprefix",

    async execute(message, args) {

        if (!OWNER_IDS.includes(message.author.id)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#FF7F7F")
                        .setDescription("<:WarningIcon:1514708751385497721> Only my owner can use this command.")
                ]
            });
        }

        const sub = args[0]?.toLowerCase();

        if (!sub) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setTitle("<:vip:1514699727072133233> No Prefix")
                        .setDescription(
                            "`,noprefix add @user`\n" +
                            "`,noprefix remove @user`\n" +
                            "`,noprefix list`"
                        )
                ]
            });
        }

        if (sub === "add") {
            const user = message.mentions.users.first();
            if (!user) return message.reply("Mention a user.");

            await db.set(`noprefix_${user.id}`, true);

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#57F287")
                        .setDescription(`<:Tick:1514714190500335677> ${user} can now use commands without prefix.`)
                ]
            });
        }

        if (sub === "remove") {
            const user = message.mentions.users.first();
            if (!user) return message.reply("Mention a user.");

            await db.delete(`noprefix_${user.id}`);

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#57F287")
                        .setDescription(`<:Tick:1514714190500335677> Removed no-prefix from ${user}.`)
                ]
            });
        }

        if (sub === "list") {
            const all = await db.all();
            const users = all
                .filter(x => x.id.startsWith("noprefix_"))
                .map(x => `<@${x.id.replace("noprefix_", "")}>`);

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#D3D3D3")
                        .setTitle("<:vip:1514699727072133233> No Prefix Users")
                        .setDescription(users.length ? users.join("\n") : "No users added.")
                ]
            });
        }
    }
};
