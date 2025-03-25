/**
 * 데이터베이스 스키마 관리 및 초기화
 */
const { withTransaction, pool } = require("./db");
const { createLogger } = require("../logging/logger");

const logger = createLogger("SCHEMA_MANAGER");

/**
 * 데이터베이스 스키마를 초기화합니다
 * @returns {Promise<boolean>} 초기화 성공 여부
 */
async function initializeSchema() {
  return withTransaction(async (client) => {
    try {
      // 유니크 제약조건 추가
      await client.query(`
        ALTER TABLE reservations 
        ADD CONSTRAINT reservations_unique_reservation 
        UNIQUE (reservation_number, platform);
      `);

      // 인덱스 생성
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_reservations_number_platform 
        ON reservations(reservation_number, platform);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_reservations_status_message 
        ON reservations(reservation_status, message_sent);
      `);

      logger.success("SCHEMA", "데이터베이스 스키마가 성공적으로 초기화되었습니다.");
      return true;
    } catch (error) {
      // 이미 제약조건이 존재하는 경우 무시
      if (error.code === "42P07" || error.message.includes("already exists")) {
        logger.info("SCHEMA", "이미 데이터베이스 스키마가 초기화되어 있습니다.");
        return true;
      }
      logger.error("SCHEMA", "데이터베이스 스키마 초기화 중 오류:", error);
      return false;
    }
  });
}

module.exports = { initializeSchema };
