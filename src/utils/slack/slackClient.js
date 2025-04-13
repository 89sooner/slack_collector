/**
 * Slack API와 통신하는 클라이언트 모듈
 */
const { WebClient } = require("@slack/web-api");
const config = require("../../../config/config");
const { createLogger } = require("../logging/logger");

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
    // 최대 재시도 횟수
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
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
        attempt++;

        // Rate limit 오류인 경우
        if (error.code === "slack_webapi_platform_error" && error.data && error.data.retry_after) {
          const retryAfter = parseInt(error.data.retry_after) || 10;
          logger.warn(
            "RATE_LIMIT",
            `Slack API Rate Limit에 도달했습니다. ${retryAfter}초 후 재시도합니다. (시도: ${attempt}/${maxRetries})`
          );

          // 지정된 시간만큼 대기
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        } else if (attempt < maxRetries) {
          // 기타 오류는 지수 백오프로 재시도
          const backoffTime = Math.pow(2, attempt) * 1000;
          logger.warn(
            "RETRY",
            `요청 실패, ${backoffTime / 1000}초 후 재시도합니다. (시도: ${attempt}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
        } else {
          // 최대 재시도 횟수를 초과한 경우
          throw error;
        }
      }
    }
    throw new Error(`최대 재시도 횟수(${maxRetries})를 초과했습니다.`);
  } catch (error) {
    logger.error("FETCH", `채널 ${channelId}에서 메시지 가져오기 실패:`, error);
    throw error;
  }
}

module.exports = { getChannelHistory };
