
const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('react')
        .setDescription('React to any message with an emoji.')
        .addStringOption(option =>
            option
                .setName('message_id')
                .setDescription('The ID of the message to react to.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('emoji')
                .setDescription('The emoji to react with.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const messageId = interaction.options.getString('message_id');
        const emojiInput = interaction.options.getString('emoji');

        await interaction.deferReply({ ephemeral: true });

        try {
            if (!/^\d{17,20}$/.test(messageId)) {
                return interaction.editReply(
                    '❌ Invalid message ID.'
                );
            }

            let emoji = emojiInput.trim();

            // Convert custom emoji syntax into Discord API format
            const customEmoji = emoji.match(
                /^<(a?):([a-zA-Z0-9_]{2,32}):(\d{17,20})>$/
            );

            if (customEmoji) {
                emoji = `${customEmoji[3]}`;
            }

            const channel = await interaction.client.channels.fetch(
                interaction.channelId
            );

            if (!channel || !channel.isTextBased() || !channel.messages) {
                return interaction.editReply(
                    '❌ This channel does not support messages.'
                );
            }

            const targetMessage = await channel.messages.fetch(messageId)
                .catch(() => null);

            if (!targetMessage) {
                return interaction.editReply(
                    '❌ Message not found in this channel.'
                );
            }

            const me = interaction.guild.members.me;

            if (!me) {
                return interaction.editReply(
                    '❌ Could not verify bot permissions.'
                );
            }

            const permissions = targetMessage.channel.permissionsFor(me);

            if (!permissions?.has(PermissionFlagsBits.AddReactions)) {
                return interaction.editReply(
                    '❌ I need the Add Reactions permission.'
                );
            }

            if (customEmoji && !permissions.has(
                PermissionFlagsBits.UseExternalEmojis
            )) {
                // Custom emojis from this server may still work
                const emojiGuild = interaction.guild.emojis.cache.get(
                    customEmoji[3]
                );

                if (!emojiGuild) {
                    return interaction.editReply(
                        '❌ I need the Use External Emojis permission.'
                    );
                }
            }

            await targetMessage.react(emoji);

            return interaction.editReply(
                `✅ Successfully reacted to [the message](${targetMessage.url}) with ${emojiInput}.`
            );

        } catch (error) {
            console.error('React command error:', error);

            return interaction.editReply(
                '❌ Could not react. Check the emoji and my permissions.'
            );
        }
    }
};
