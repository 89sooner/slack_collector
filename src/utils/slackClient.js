/**
 * Slack API와 통신하는 클라이언트 모듈
 */
const { WebClient } = require("@slack/web-api");
const config = require("../../config/config");
const { createLogger } = require("./logger");

const logger = createLogger("SLACK_CLIENT");
const web = new WebClient(config.SLACK_BOT_TOKEN);

/**
 * 채널 기록을 가져옵니다
 * @param {string} channelId - Slack 채널 ID
 * @param {string} oldestTs - 가져올 가장 오래된 메시지의 타임스탬프
 * @returns {Promise<Object>} 채널 메시지 기록
 */
async function getChannelHistory(channelId, oldestTs) {
  try {
    const result = await web.conversations.history({
      channel: channelId,
      oldest: oldestTs,
    });

    logger.info(
      "FETCH",
      `채널 ${channelId}에서 ${result.messages.length}개의 메시지를 가져왔습니다.`
    );

    return result;
  } catch (error) {
    logger.error("FETCH", `채널 ${channelId}에서 메시지 가져오기 실패:`, error);
    throw error;
  }
}

module.exports = { getChannelHistory };
