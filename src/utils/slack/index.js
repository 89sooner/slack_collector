/**
 * Slack 관련 모듈 export
 */
const { getChannelHistory } = require("./slackClient");
const { downloadAndReadHtml } = require("./fileDownloader");

module.exports = {
  getChannelHistory,
  downloadAndReadHtml,
};
