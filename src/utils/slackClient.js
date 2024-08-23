const { WebClient } = require("@slack/web-api");
const config = require("../../config/config");

const web = new WebClient(config.SLACK_BOT_TOKEN);

async function getChannelHistory(channelId, oldestTs) {
  return await web.conversations.history({
    channel: channelId,
    oldest: oldestTs,
  });
}

module.exports = { getChannelHistory };
