const cooldown = new Map();
const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "purge",
  async execute(message, args = []) {
    if (!message.member.permissions.has("ManageMessages")) {
      return message.reply("❌ You don't have permission to purge messages!");
    }

    const now = Date.now();
    const lastUsed = cooldown.get(message.author.id);
    if (lastUsed && now - lastUsed < 10000) {
      return message.reply("⏳ Wait 10 seconds before using purge again!");
    }
    cooldown.set(message.author.id, now);

    const targetUser = message.mentions.users.first();
    const isBotMode =
      args[0] === "bots" ||
      args[0] === "bot" ||
      args[0] === "pb" ||
      message.content.startsWith("!pb");

    const limit = (n) => {
      if (!n || Number.isNaN(n)) return 10;
      return Math.min(Math.max(n, 1), 100);
    };

    const sendSummary = async (deletedMessages, title = "Purge Summary") => {
      const counts = new Map();
      for (const msg of deletedMessages.values()) {
        if (msg.id === message.id) continue;
        counts.set(msg.author.id, (counts.get(msg.author.id) || 0) + 1);
      }

      const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
      const details = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([userId, count]) => `<@${userId}> — **${count}** messages deleted`);

      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(title)
        .setDescription([
          `🧹 **Purged ${total} messages.**`,
          "",
          ...(details.length ? details : ["No messages were deleted."])
        ].join("\n"))
        .setFooter({ text: `Requested by ${message.author.username}` })
        .setTimestamp();

      const mentionedUserIds = [...counts.keys()];

      return message.channel.send({
        // Mentions in embeds do not generate notifications. Put the mentions
        // in message content and explicitly allow only the users purged.
        content: mentionedUserIds.length
          ? mentionedUserIds.map(userId => `<@${userId}>`).join(" ")
          : undefined,
        embeds: [embed],
        allowedMentions: {
          parse: [],
          users: mentionedUserIds,
          roles: [],
          repliedUser: false
        }
      });
    };

    if (isBotMode) {
      const amount = limit(parseInt(args[1], 10));
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const botMessages = messages.filter(m => m.author.bot && m.id !== message.id).first(amount);
      const deleted = await message.channel.bulkDelete(botMessages, true);
      return sendSummary(deleted, "Bot Purge Summary");
    }

    if (targetUser) {
      const amount = limit(parseInt(args[1], 10));
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const userMessages = messages
        .filter(m => m.author.id === targetUser.id && m.id !== message.id)
        .first(amount);
      const deleted = await message.channel.bulkDelete(userMessages, true);
      return sendSummary(deleted, "User Purge Summary");
    }

    const requested = parseInt(args[0], 10);
    if (!Number.isInteger(requested) || requested < 1) {
      return message.reply("❌ Use: `,purge <number>` or `,purge @user <number>`");
    }

    const amount = limit(requested);
    const messages = await message.channel.messages.fetch({ limit: Math.min(amount + 1, 100) });
    const selected = messages.first(amount + 1);
    const deleted = await message.channel.bulkDelete(selected, true);
    return sendSummary(deleted, "Purge Summary");
  }
};
