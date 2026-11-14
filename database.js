const { QuickDB } = require("quick.db");

const db = new QuickDB({
    filePath: "/data/json.sqlite"
});

module.exports = db; 
