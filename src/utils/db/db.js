/**
 * 데이터베이스 연결 및 쿼리 기능 제공
 */
const { Pool } = require("pg");
const config = require("../../../config/config");
const { createLogger } = require("../logging/logger");

const logger = createLogger("DATABASE");

const pool = new Pool({
  user: config.DB_USER,
  host: config.DB_HOST,
  database: config.DB_DATABASE,
  password: config.DB_PASSWORD,
  port: config.DB_PORT,
});

/**
 * 데이터베이스 쿼리를 실행합니다
 * @param {string} query - SQL 쿼리 문자열
 * @param {Array} params - 쿼리 파라미터
 * @returns {Promise<Object>} 쿼리 결과
 */
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } catch (error) {
    logger.error("QUERY", "데이터베이스 쿼리 실행 중 오류:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 트랜잭션 내에서 여러 쿼리를 실행합니다
 * @param {Function} callback - 트랜잭션 내에서 실행할 콜백 함수
 * @returns {Promise<any>} 트랜잭션 실행 결과
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("TRANSACTION", "트랜잭션 실행 중 오류:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 데이터베이스 연결을 테스트합니다
 * @returns {Promise<boolean>} 연결 성공 여부
 */
async function testConnection() {
  try {
    await pool.query("SELECT NOW()");
    logger.success("CONNECTION", "데이터베이스에 성공적으로 연결되었습니다.");
    return true;
  } catch (error) {
    logger.error("CONNECTION", "데이터베이스 연결 실패:", error);
    return false;
  }
}

/**
 * 데이터베이스 연결을 재시도하며 테스트합니다
 * @param {number} retries - 재시도 횟수
 * @param {number} delay - 재시도 간격(ms)
 * @returns {Promise<boolean>} 연결 성공 여부
 */
async function testConnectionWithRetry(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    if (await testConnection()) {
      return true;
    }
    logger.info("RETRY", `데이터베이스 연결 재시도 중... (${i + 1}/${retries})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
}

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

/**
 * 예약 정보를 데이터베이스에 저장합니다
 * @param {Object} data - 저장할 예약 데이터
 * @returns {Promise<boolean>} 저장 성공 여부
 */
async function saveReservation(data) {
  try {
    // created_at 필드 추가
    const dataWithTimestamp = {
      ...data,
      created_at: new Date(), // 현재 시간 추가
    };

    const columns = Object.keys(dataWithTimestamp);

    // 유니크 제약조건이 있는지 확인
    try {
      const constraintCheck = await pool.query(`
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'reservations_unique_reservation'
      `);

      let query;
      if (constraintCheck.rows.length > 0) {
        // 유니크 제약조건이 있으면 UPSERT 사용
        query = `
          INSERT INTO reservations (${columns.join(", ")})
          VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})
          ON CONFLICT (reservation_number, platform) 
          DO UPDATE SET 
            ${columns
              .filter((col) => col !== "id")
              .map((col) => `${col} = EXCLUDED.${col}`)
              .join(", ")}
        `;
      } else {
        // 유니크 제약조건이 없으면 일반 INSERT 사용
        query = `
          INSERT INTO reservations (${columns.join(", ")})
          VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})
        `;
      }

      const values = Object.values(dataWithTimestamp);
      await executeQuery(query, values);
    } catch (error) {
      // 제약조건 확인 실패 시 일반 INSERT로 시도
      const query = `
        INSERT INTO reservations (${columns.join(", ")})
        VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})
      `;
      const values = Object.values(dataWithTimestamp);
      await executeQuery(query, values);
    }

    logger.success("SAVING", `[${data.platform}] 예약 정보가 데이터베이스에 저장되었습니다.`);
    return true;
  } catch (error) {
    logger.error("SAVING", `데이터베이스 저장 중 오류 발생 (${data.platform}):`, error);
    return false;
  }
}

// 애플리케이션 종료 시 Pool 닫기
process.on("exit", () => {
  logger.info("CONNECTION", "데이터베이스 연결을 종료합니다...");
  pool.end();
});

module.exports = {
  pool,
  executeQuery,
  withTransaction,
  testConnection,
  testConnectionWithRetry,
  saveReservation,
  initializeSchema,
};
