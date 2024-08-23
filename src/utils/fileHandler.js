const fs = require("fs").promises;
const path = require("path");

const LAST_READ_TS_FILE = path.join(__dirname, "../../last_read_ts.json");

async function getLastReadTs() {
  try {
    const data = await fs.readFile(LAST_READ_TS_FILE, "utf8");
    return JSON.parse(data).lastReadTs;
  } catch (error) {
    return null;
  }
}

async function saveLastReadTs(ts) {
  await fs.writeFile(LAST_READ_TS_FILE, JSON.stringify({ lastReadTs: ts }));
}

module.exports = { getLastReadTs, saveLastReadTs };
