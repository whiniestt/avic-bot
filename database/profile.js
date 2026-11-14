const { QuickDB } = require("quick.db");

const db = require(process.cwd() + "/database");

module.exports = {

    async get(userId) {
        return (await db.get(`profile_${userId}`)) || {};
    },

    async set(userId, data) {
        const profile = (await db.get(`profile_${userId}`)) || {};

        await db.set(`profile_${userId}`, {
            ...profile,
            ...data
        });
    },

    async reset(userId) {
        await db.delete(`profile_${userId}`);
    }

};
