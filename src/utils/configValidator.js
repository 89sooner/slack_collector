/**
 * 애플리케이션 설정을 검증하는 모듈
 */
const { createLogger } = require("./logger");
const logger = createLogger("CONFIG_VALIDATOR");

/**
 * 필수 환경 변수가 설정되어 있는지 확인합니다
 * @param {Object} config - 검증할 설정 객체
 * @returns {boolean} 검증 성공 여부
 */
function validateConfig(config) {
  const requiredKeys = [
    "SLACK_BOT_TOKEN",
    "CHANNEL_ID_YANOLJA",
    "CHANNEL_ID_NAVER_BOOKING",
    "CHANNEL_ID_AIRBNB",
    "CHANNEL_ID_YEOGI",
    "DB_USER",
    "DB_HOST",
    "DB_DATABASE",
    "DB_PASSWORD",
    "DB_PORT",
  ];

  const missingKeys = [];

  requiredKeys.forEach((key) => {
    if (!config[key]) {
      missingKeys.push(key);
    }
  });

  if (missingKeys.length > 0) {
    logger.error("VALIDATION", `다음 환경 변수가 설정되지 않았습니다: ${missingKeys.join(", ")}`);
    return false;
  }

  // 데이터베이스 포트가 숫자인지 확인
  if (isNaN(parseInt(config.DB_PORT))) {
    logger.error("VALIDATION", "DB_PORT는 숫자여야 합니다.");
    return false;
  }

  logger.success("VALIDATION", "모든 설정이 올바르게 검증되었습니다.");
  return true;
}

module.exports = { validateConfig };
