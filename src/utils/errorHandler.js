/**
 * 애플리케이션 전체의 에러 처리를 담당하는 유틸리티
 */
const { createLogger } = require("./logger");
const logger = createLogger("ERROR_HANDLER");

/**
 * 에러를 적절히 처리하고 로깅합니다
 * @param {Error} error - 발생한 에러 객체
 * @param {string} context - 에러가 발생한 컨텍스트
 * @param {string} operation - 수행 중이던 작업
 * @returns {Error} 원본 에러를 그대로 반환
 */
function handleError(error, context, operation) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code || "UNKNOWN",
    timestamp: new Date().toISOString(),
  };

  logger.error(operation, `${context} 작업 중 오류 발생:`, errorInfo);

  // 데이터베이스 관련 에러에 대한 특별 처리
  if (isDbError(error)) {
    handleDbError(error, context);
  }

  // 네트워크 관련 에러에 대한 특별 처리
  if (isNetworkError(error)) {
    handleNetworkError(error, context);
  }

  return error;
}

/**
 * 데이터베이스 관련 에러인지 확인합니다
 * @param {Error} error - 검사할 에러
 * @returns {boolean} 데이터베이스 에러 여부
 */
function isDbError(error) {
  // PostgreSQL 에러 코드로 시작하는지 확인
  return error.code && /^[0-9A-Z]{5}$/.test(error.code);
}

/**
 * 네트워크 관련 에러인지 확인합니다
 * @param {Error} error - 검사할 에러
 * @returns {boolean} 네트워크 에러 여부
 */
function isNetworkError(error) {
  const networkErrorMessages = [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "socket hang up",
  ];
  return networkErrorMessages.some((msg) => error.message && error.message.includes(msg));
}

/**
 * 데이터베이스 에러 처리
 * @param {Error} error - 데이터베이스 에러
 * @param {string} context - 에러 컨텍스트
 */
function handleDbError(error, context) {
  // 특정 데이터베이스 에러 코드에 따른 처리
  switch (error.code) {
    case "23505": // 중복 키 에러
      logger.warning("DB_ERROR", `${context}에서 중복 키 에러 발생`);
      break;
    case "42P01": // 테이블 없음
      logger.error("DB_ERROR", `${context}에서 테이블 없음 에러 발생`);
      break;
    default:
      logger.error("DB_ERROR", `${context}에서 데이터베이스 에러 발생: ${error.code}`);
  }
}

/**
 * 네트워크 에러 처리
 * @param {Error} error - 네트워크 에러
 * @param {string} context - 에러 컨텍스트
 */
function handleNetworkError(error, context) {
  logger.error("NETWORK_ERROR", `${context}에서 네트워크 에러 발생: ${error.message}`);
  // 잠시 후 재시도 로직 등을 여기에 추가할 수 있음
}

module.exports = { handleError };
