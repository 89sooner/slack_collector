/**
 * 채널 상태(마지막 읽은 타임스탬프) 관리 모듈
 */
const { pool, executeQuery } = require("./db");
const { createLogger } = require("../logging/logger");

const logger = createLogger("CHANNEL_STATE");

/**
 * 채널 상태 테이블 초기화
 * @returns {Promise<boolean>} 초기화 성공 여부
 */
async function initChannelStateTable() {
  try {
    // 채널 상태 테이블 생성
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS channel_state (
        channel_id VARCHAR(50) PRIMARY KEY,
        last_read_ts VARCHAR(30) NOT NULL,
        channel_name VARCHAR(50),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info("INIT", "채널 상태 테이블이 초기화되었습니다.");
    return true;
  } catch (error) {
    logger.error("INIT", "채널 상태 테이블 초기화 중 오류:", error);
    return false;
  }
}

/**
 * 채널의 마지막으로 읽은 타임스탬프 조회
 * @param {string} channelId - 채널 ID
 * @returns {Promise<string|null>} 마지막으로 읽은 타임스탬프 또는 null
 */
async function getChannelLastReadTs(channelId) {
  try {
    const result = await executeQuery(
      "SELECT last_read_ts FROM channel_state WHERE channel_id = $1",
      [channelId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].last_read_ts;
    }

    // 처음 실행되는 경우 기록 없음
    logger.info("STATE", `채널 ${channelId}의 기록이 없습니다. 초기화합니다.`);
    return null;
  } catch (error) {
    logger.error("STATE", `채널 ${channelId} 상태 조회 중 오류:`, error);
    return null;
  }
}

/**
 * 채널의 마지막으로 읽은 타임스탬프 업데이트
 * @param {string} channelId - 채널 ID
 * @param {string} channelName - 채널 이름
 * @param {string} lastReadTs - 마지막으로 읽은 타임스탬프
 * @returns {Promise<boolean>} 업데이트 성공 여부
 */
async function saveChannelLastReadTs(channelId, channelName, lastReadTs) {
  try {
    await executeQuery(
      `
      INSERT INTO channel_state (channel_id, channel_name, last_read_ts, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (channel_id) 
      DO UPDATE SET 
        last_read_ts = $3,
        channel_name = $2,
        updated_at = CURRENT_TIMESTAMP
    `,
      [channelId, channelName, lastReadTs]
    );

    logger.info("STATE", `채널 ${channelId}의 마지막 읽은 타임스탬프 업데이트: ${lastReadTs}`);
    return true;
  } catch (error) {
    logger.error("STATE", `채널 ${channelId} 상태 업데이트 중 오류:`, error);
    return false;
  }
}

/**
 * 모든 채널 상태 조회
 * @returns {Promise<Array>} 채널 상태 목록
 */
async function getAllChannelStates() {
  try {
    const result = await executeQuery(`
      SELECT 
        channel_id, 
        channel_name, 
        last_read_ts, 
        updated_at 
      FROM channel_state 
      ORDER BY updated_at DESC
    `);

    return result.rows;
  } catch (error) {
    logger.error("STATE", "모든 채널 상태 조회 중 오류:", error);
    return [];
  }
}

module.exports = {
  initChannelStateTable,
  getChannelLastReadTs,
  saveChannelLastReadTs,
  getAllChannelStates,
};
