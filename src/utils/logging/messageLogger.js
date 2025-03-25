/**
 * 메시지 로깅을 담당하는 모듈
 */
const fs = require("fs");
const path = require("path");
const { createLogger } = require("./logger");

const logger = createLogger("MESSAGE_LOGGER");

// 로그 파일 경로 설정
const logDir = path.join(__dirname, "..", "..", "..", "logs");
const logFile = path.join(logDir, "message_logs.txt");

/**
 * 로그 디렉토리 존재 여부 확인 및 생성
 * @returns {boolean} 디렉토리 생성 성공 여부
 */
function ensureLogDirectory() {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true, mode: 0o755 });
      logger.info("INIT", `로그 디렉토리 생성 완료: ${logDir}`);
    }
    return true;
  } catch (error) {
    logger.error("INIT", `로그 디렉토리 생성 실패: ${error.message}`);
    return false;
  }
}

/**
 * 메시지를 파일에 비동기적으로 로깅합니다
 * @param {Object} message - 로깅할 Slack 메시지
 * @returns {Promise<boolean>} 로깅 성공 여부
 */
async function logMessageToFile(message) {
  if (!ensureLogDirectory()) {
    return false;
  }

  const logEntry = `${new Date().toISOString()} - ${JSON.stringify(message)}\n`;

  try {
    await fs.promises.appendFile(logFile, logEntry, { encoding: "utf8", mode: 0o644 });
    return true;
  } catch (error) {
    // 권한 오류 처리
    if (error.code === "EACCES") {
      logger.error("WRITE", `로그 파일 쓰기 권한이 없습니다: ${logFile}`);

      // 임시 대안: 메모리에 로그 저장
      if (!global.inMemoryLogs) {
        global.inMemoryLogs = [];
      }
      global.inMemoryLogs.push(logEntry);
      logger.warning("WRITE", "로그를 메모리에 임시 저장합니다. 권한 문제를 해결하세요.");
    } else {
      logger.error("WRITE", `로그 파일 쓰기 중 오류 발생: ${error.message}`);
    }
    return false;
  }
}

/**
 * 메시지를 파일에 동기적으로 로깅하는 대체 함수
 * 비동기 방식이 실패할 경우 사용
 * @param {Object} message - 로깅할 Slack 메시지
 * @returns {boolean} 로깅 성공 여부
 */
function logMessageToFileSync(message) {
  if (!ensureLogDirectory()) {
    return false;
  }

  const logEntry = `${new Date().toISOString()} - ${JSON.stringify(message)}\n`;

  try {
    fs.appendFileSync(logFile, logEntry);
    return true;
  } catch (error) {
    // 로깅 실패 시 콘솔에 출력만 하고 진행
    logger.error("WRITE", `로그 파일 동기 쓰기 중 오류: ${error.message}`);
    return false;
  }
}

module.exports = {
  logMessageToFile,
  logMessageToFileSync,
  logFile,
  ensureLogDirectory,
};
