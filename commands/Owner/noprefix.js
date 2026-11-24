const { EmbedBuilder } = require('discord.js');
const db = require(process.cwd() + '/database');
const {
    NO_PREFIX_DURATIONS,
    activateNoPrefix,
    hasStandaloneNoPrefix,
    hasPremium,
    formatDuration,
    formatExpiration
} = require(process.cwd() + '/utils/entitlements');

const OWNER_IDS = [
    '1306606920836055043',
    '1530872106399567941'
];

function replyEmbed(message, title, description, color = '#D3D3D3') {
    return message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(description)
        ],
        allowedMentions: { parse: [] }
    });
}

module.exports = {
    name: 'noprefix',

    async execute(message, args) {
        if (!OWNER_IDS.includes(message.author.id)) {
            return replyEmbed(
                message,
                'Owner Only',
                '<:WarningIcon:1514708751385497721> Only my owner can use this command.',
                '#FF7F7F'
            );
        }

        const sub = args[0]?.toLowerCase();

        if (!sub) {
            return replyEmbed(
                message,
                '<:vip:1514699727072133233> No Prefix',
                '`,noprefix activate @user <1m|3m|lifetime>` — timed global no-prefix\n' +
                '`,noprefix add @user` — permanent global no-prefix\n' +
                '`,noprefix remove @user`\n' +
                '`,noprefix list`'
            );
        }

        if (sub === 'activate') {
            const user = message.mentions.users.first();
            const duration = args
                .slice(1)
                .map(value => value.toLowerCase())
                .find(value => NO_PREFIX_DURATIONS.includes(value));

            if (!user || !duration) {
                return replyEmbed(
                    message,
                    'Invalid Activation',
                    'Use `,noprefix activate @user <1m|3m|lifetime>`.',
                    '#FF7F7F'
                );
            }

            const grant = await activateNoPrefix(user.id, duration);
            if (!grant) {
                return replyEmbed(
                    message,
                    'Invalid Duration',
                    'Choose `1m`, `3m`, or `lifetime`.',
                    '#FF7F7F'
                );
            }

            return replyEmbed(
                message,
                '<:vip:1514699727072133233> No Prefix Activated',
                `Global no-prefix is active for <@${user.id}>.\n\n` +
                `**Duration:** ${formatDuration(duration)}\n` +
                `**${formatExpiration(grant.expiresAt)}**`,
                '#D3D3D3'
            );
        }

        if (sub === 'add') {
            const user = message.mentions.users.first();
            if (!user) return message.reply('Mention a user.');

            // Legacy add remains a permanent no-prefix grant.
            await db.set(`noprefix_${user.id}`, true);

            return replyEmbed(
                message,
                'No Prefix Added',
                `<:Tick:1514714190500335677> ${user} can use commands without a prefix in every server.`,
                '#57F287'
            );
        }

        if (sub === 'remove') {
            const user = message.mentions.users.first();
            if (!user) return message.reply('Mention a user.');

            await db.delete(`noprefix_${user.id}`);
            const premiumStillActive = await hasPremium(user.id);
            const description = premiumStillActive
                ? `<:Tick:1514714190500335677> Removed the standalone no-prefix grant for ${user}. Their active Premium still includes global no-prefix.`
                : `<:Tick:1514714190500335677> Removed global no-prefix from ${user}.`;

            return replyEmbed(
                message,
                'No Prefix Removed',
                description,
                '#57F287'
            );
        }

        if (sub === 'list') {
            const entries = (await db.all())
                .filter(entry => entry.id.startsWith('noprefix_'));
            const users = [];

            for (const entry of entries) {
                const userId = entry.id.slice('noprefix_'.length);
                if (!(await hasStandaloneNoPrefix(userId))) continue;

                const grant = await db.get(entry.id);
                const expiry = grant === true
                    ? 'Lifetime'
                    : grant?.expiresAt === null
                        ? 'Lifetime'
                        : grant?.expiresAt
                            ? `until <t:${Math.floor(grant.expiresAt / 1000)}:R>`
                            : 'Active';
                users.push(`<@${userId}> — ${expiry}`);
            }

            return replyEmbed(
                message,
                '<:vip:1514699727072133233> No Prefix Users',
                users.length ? users.join('\n') : 'No active standalone no-prefix grants.'
            );
        }

        return replyEmbed(
            message,
            'Unknown Action',
            'Use `activate`, `add`, `remove`, or `list`.',
            '#FF7F7F'
        );
    }
};
