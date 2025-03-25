const fs = require("fs").promises;
const path = require("path");
const { createLogger } = require("../logging/logger");

const logger = createLogger("FILE_HANDLER");

// 환경에 따른 경로 설정
const getConfigPath = () => {
  // Docker 환경에서는 /tmp 디렉토리 사용 (쓰기 가능한 디렉토리)
  const isDocker = process.env.RUNNING_IN_DOCKER === "true";
  if (isDocker) {
    return path.join("/tmp", "last_read_ts.json");
  }
  return path.join(__dirname, "..", "..", "..", "data", "last_read_ts.json");
};

const CONFIG_PATH = getConfigPath();

/**
 * 타임스탬프 파일의 디렉토리를 생성합니다
 */
async function ensureConfigDirectory() {
  try {
    const configDir = path.dirname(CONFIG_PATH);
    await fs.mkdir(configDir, { recursive: true });
    return true;
  } catch (error) {
    logger.error("INIT", `설정 디렉토리 생성 실패: ${error.message}`);
    return false;
  }
}

/**
 * 마지막으로 읽은 타임스탬프를 가져옵니다
 * @returns {Promise<string|null>} 마지막으로 읽은 타임스탬프 또는 null
 */
async function getLastReadTs() {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(data).lastReadTs;
  } catch (error) {
    // 파일이 없는 경우 (첫 실행)는 정상이므로 경고 로그 없이 null 반환
    if (error.code === "ENOENT") {
      // 첫 실행 시에만 로그 메시지 출력
      if (!global.initMessageLogged) {
        logger.info("INIT", "이전 타임스탬프 정보가 없습니다. 새로 시작합니다.");
        global.initMessageLogged = true;
      }
      return null;
    }

    // 권한 문제인 경우
    if (error.code === "EACCES") {
      logger.warning("FILE", `타임스탬프 파일 읽기 권한이 없습니다: ${CONFIG_PATH}`);
      return getMemoryLastReadTs();
    }

    // 기타 에러
    logger.error("FILE", `타임스탬프 파일 읽기 오류:`, error);
    return null;
  }
}

/**
 * 마지막으로 읽은 타임스탬프를 저장합니다
 * @param {string} ts - 저장할 타임스탬프
 */
async function saveLastReadTs(ts) {
  try {
    // 디렉토리 확인 및 생성
    await ensureConfigDirectory();

    // 파일 저장
    await fs.writeFile(CONFIG_PATH, JSON.stringify({ lastReadTs: ts }));
    logger.info("FILE", `마지막 읽은 타임스탬프 저장: ${ts}`);
  } catch (error) {
    // 파일 쓰기 권한 오류 처리
    if (error.code === "EACCES") {
      logger.error("FILE", `타임스탬프 파일에 쓰기 권한이 없습니다: ${CONFIG_PATH}`);
      // 메모리에 마지막 타임스탬프 임시 저장
      global.lastReadTs = ts;
      logger.warning("FILE", `타임스탬프를 메모리에 임시 저장합니다: ${ts}`);
    } else {
      logger.error("FILE", `타임스탬프 파일 쓰기 오류:`, error);
    }
  }
}

// 메모리에 저장된 타임스탬프 조회 (권한 문제 대체 방안)
function getMemoryLastReadTs() {
  return global.lastReadTs || null;
}

module.exports = {
  getLastReadTs,
  saveLastReadTs,
  getMemoryLastReadTs,
};
