const db = require('../database');

const TARGET_GUILD_ID = '1556755633699823667';
const REWARD_ROLE_ID = '1570010022891622442';
const MESSAGE_THRESHOLD = 60;
const RETRY_DELAY_MS = 60 * 1000;

module.exports = client => {
  const assignmentsInProgress = new Set();
  const lastAssignmentAttempt = new Map();

  client.on('messageCreate', async message => {
    if (!message.guild || message.guild.id !== TARGET_GUILD_ID) return;
    if (message.author.bot || message.webhookId) return;

    const counterKey = `message_role_reward_${TARGET_GUILD_ID}_${message.author.id}`;

    try {
      const rawCount = await db.add(counterKey, 1);
      const messageCount = Number(rawCount);
      if (!Number.isFinite(messageCount) || messageCount < MESSAGE_THRESHOLD) return;

      const assignmentKey = `${TARGET_GUILD_ID}_${message.author.id}`;
      if (assignmentsInProgress.has(assignmentKey)) return;

      const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member || member.roles.cache.has(REWARD_ROLE_ID)) return;

      const lastAttempt = lastAssignmentAttempt.get(assignmentKey) || 0;
      if (Date.now() - lastAttempt < RETRY_DELAY_MS) return;

      assignmentsInProgress.add(assignmentKey);
      lastAssignmentAttempt.set(assignmentKey, Date.now());

      try {
        const role = message.guild.roles.cache.get(REWARD_ROLE_ID) ||
          await message.guild.roles.fetch(REWARD_ROLE_ID);
        if (!role) {
          console.warn(`MESSAGE ROLE REWARD: role ${REWARD_ROLE_ID} was not found in guild ${TARGET_GUILD_ID}.`);
          return;
        }

        await member.roles.add(role, 'Reached 60 messages in Fare’s reward server');
        console.log(`MESSAGE ROLE REWARD: awarded ${REWARD_ROLE_ID} to ${message.author.id} after ${messageCount} messages.`);
      } catch (error) {
        console.warn(`MESSAGE ROLE REWARD ERROR (${message.author.id}):`, error?.message || error);
      } finally {
        assignmentsInProgress.delete(assignmentKey);
      }
    } catch (error) {
      console.warn(`MESSAGE ROLE REWARD COUNTER ERROR (${message.author.id}):`, error?.message || error);
    }
  });
};
