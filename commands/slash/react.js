const {
    SlashCommandBuilder,
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("react")
        .setDescription("React to any message with an emoji.")

        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("The channel containing the message.")
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("message_id")
                .setDescription("The ID of the message.")
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("emoji")
                .setDescription("The emoji to react with.")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({
            ephemeral: true
        });

        try {
            const channel = interaction.options.getChannel("channel");
            const messageId = interaction.options.getString("message_id").trim();
            const emojiInput = interaction.options.getString("emoji").trim();

            if (!/^\d{17,20}$/.test(messageId)) {
                return interaction.editReply("❌ Invalid message ID.");
            }

            const permissions = channel.permissionsFor(
                interaction.guild.members.me
            );

            if (!permissions?.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AddReactions
            ])) {
                return interaction.editReply(
                    "❌ I need View Channel, Read Message History and Add Reactions permissions."
                );
            }

            const message = await channel.messages
                .fetch(messageId)
                .catch(() => null);

            if (!message) {
                return interaction.editReply(
                    "❌ Message not found in this channel."
                );
            }

            const customEmoji = emojiInput.match(
                /^<(a?):([a-zA-Z0-9_]{2,32}):(\d{17,20})>$/
            );

            const emoji = customEmoji
                ? `${customEmoji[2]}:${customEmoji[3]}`
                : emojiInput;

            await message.react(emoji);

            return interaction.editReply(
                `✅ Successfully reacted with ${emojiInput}!\n[Jump to message](${message.url})`
            );

        } catch (error) {
            console.error("REACT COMMAND ERROR:", error);

            return interaction.editReply(
                "❌ Couldn't add that reaction. Check the emoji and bot permissions."
            );
        }
    }
};
