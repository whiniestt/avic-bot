// Keeps the last 10 deleted messages per channel in memory (cleared on restart)
module.exports = (client) => {
  client.snipes = new Map(); // channelId -> [{ content, authorName, authorId, image, time }] newest first

  client.on('messageDelete', (message) => {
    if (!message.guild || message.partial || !message.author || message.author.bot) return;

    const image = message.attachments?.find((a) => a.contentType?.startsWith('image/'))?.url || null;
    if (!message.content && !image) return;

    const list = client.snipes.get(message.channel.id) || [];
    list.unshift({
      content: message.content || null,
      authorName: message.author.username,
      authorId: message.author.id,
      image,
      time: Date.now(),
    });
    client.snipes.set(message.channel.id, list.slice(0, 10));
  });
};
