/**
 * Slack 예약 메시지 수집 및 처리 메인 애플리케이션
 */
const config = require("../config/config");
const {
  validateConfig,
  getChannelHistory,
  getLastReadTs,
  saveLastReadTs,
  logMessageToFile,
  testConnection,
  saveReservation,
  initializeSchema,
  initChannelStateTable,
  getChannelLastReadTs,
  saveChannelLastReadTs,
  getAllChannelStates,
  standardizeData,
  handleError,
  monitor,
  reservationCache,
  createBackup,
  cleanOldBackups,
} = require("./utils");

const { parseYanoljaMessage } = require("./platforms/yanolja");
const { parseNaverMessage } = require("./platforms/naver");
const { parseAirbnbMessage } = require("./platforms/airbnb");
const { parseYeogiMessage } = require("./platforms/yeogi");
const { startServer } = require("./api/server");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path"); // path 모듈 추가
const { createLogger } = require("./utils/logging/logger");

const logger = createLogger("SLACK_COLLECTOR");

/**
 * 특정 채널의 메시지를 처리합니다
 * @param {string} channelId - Slack 채널 ID
 * @param {string} channelName - Slack 채널 이름
 * @param {Function} parseFunction - 해당 채널 메시지의 파싱 함수
 */
async function processMessages(channelId, channelName, parseFunction) {
  try {
    // 기존 방식(하위 호환성 유지)
    const legacyLastReadTs = await getLastReadTs();

    // 새로운 채널별 상태 관리 방식 사용
    const channelLastReadTs = await getChannelLastReadTs(channelId);
    // 둘 중 더 최신 타임스탬프 사용 (기존 데이터 마이그레이션 고려)
    const lastReadTs = channelLastReadTs || legacyLastReadTs;

    const result = await getChannelHistory(channelId, lastReadTs);

    const newMessages = result.messages.reverse();
    if (newMessages.length === 0) {
      logger.info("FETCH", `채널 ${channelName}(${channelId})에 새 메시지가 없습니다.`);
      return;
    }

    logger.info(
      "FETCH",
      `채널 ${channelName}(${channelId})에서 ${newMessages.length}개의 새 메시지를 처리합니다.`
    );

    for (const message of newMessages) {
      try {
        if (!lastReadTs || message.ts > lastReadTs) {
          if (!shouldProcessMessage(message, parseFunction)) {
            continue;
          }

          await processMessage(message, parseFunction);
        }
      } catch (error) {
        logger.error("PROCESS", `메시지 처리 중 오류 발생 (ts: ${message.ts}):`, error);
        // 에러 발생 시 해당 메시지 처리를 건너뛰고 다음 메시지로 진행
        continue;
      }
    }

    if (newMessages.length > 0) {
      const lastTs = newMessages[newMessages.length - 1].ts;

      // 기존 방식 유지 (하위 호환성)
      await saveLastReadTs(lastTs);

      // 새로운 채널별 상태 저장
      await saveChannelLastReadTs(channelId, channelName, lastTs);

      logger.info(
        "TIMESTAMP",
        `채널 ${channelName}(${channelId})의 마지막 읽은 타임스탬프 업데이트: ${lastTs}`
      );
    }
  } catch (error) {
    logger.error("FETCH", `채널 ${channelName}(${channelId}) 처리 중 오류 발생:`, error);
  }
}

/**
 * 메시지 처리 여부를 결정합니다
 * @param {Object} message - Slack 메시지
 * @param {Function} parseFunction - 메시지 파싱 함수
 * @returns {boolean} 처리 여부
 */
function shouldProcessMessage(message, parseFunction) {
  if (parseFunction === parseAirbnbMessage) {
    const title = message.files && message.files[0] ? message.files[0].title : "";
    const validTitles = ["취소됨", "대기 중", "예약 확정"];

    if (!validTitles.some((validTitle) => title.includes(validTitle))) {
      logger.info("FILTER", `Airbnb 메시지 제목 필터링: ${title}`);
      return false;
    }
  }
  return true;
}

/**
 * 개별 메시지를 처리합니다
 * @param {Object} message - Slack 메시지
 * @param {Function} parseFunction - 메시지 파싱 함수
 */
async function processMessage(message, parseFunction) {
  try {
    // 캐시에서 이미 처리된 메시지인지 확인
    const cacheKey = `message_${message.ts}`;
    if (reservationCache.get(cacheKey)) {
      logger.info("CACHE", `이미 처리된 메시지입니다: ${message.ts}`);
      return;
    }

    const parsedMessage = await parseFunction(message);

    if (!parsedMessage) {
      logger.info("PARSING", "메시지 파싱 결과가 null입니다.");
      monitor.incrementFailedParsing();
      return;
    }

    logger.info("PARSING", "새 메시지 파싱 완료:", parsedMessage);
    monitor.incrementProcessed(parsedMessage.platform);

    // 원본 메시지 로깅 (디버깅용)
    // logMessageToFile(message);

    // 데이터 표준화
    const standardizedData = standardizeData(parsedMessage, message);

    // 데이터베이스 저장
    const saved = await saveReservation(standardizedData);

    if (saved) {
      monitor.incrementSaved();
      // 메시지 처리 완료 후 캐시에 저장
      reservationCache.set(cacheKey, { processed: true, timestamp: Date.now() });
      logger.info(
        "SAVING",
        "******************************************************************************"
      );
    }
  } catch (error) {
    handleError(error, "메시지 처리", "PROCESS_MESSAGE");
    monitor.recordError(error);
  }
}

/**
 * 모든 채널을 확인합니다
 */
async function checkAllChannels() {
  logger.info("CHECK", "Slack 인바운드 메시지 큐 확인 시작");

  try {
    await Promise.all([
      processMessages(config.CHANNEL_ID_YANOLJA, "야놀자", parseYanoljaMessage),
      processMessages(config.CHANNEL_ID_NAVER_BOOKING, "네이버", parseNaverMessage),
      processMessages(config.CHANNEL_ID_AIRBNB, "에어비앤비", parseAirbnbMessage),
      processMessages(config.CHANNEL_ID_YEOGI, "여기어때", parseYeogiMessage),
    ]);

    logger.info("CHECK", "모든 채널 확인 완료");
  } catch (error) {
    logger.error("CHECK", "채널 확인 중 오류 발생:", error);
  }
}

/**
 * 채널 상태 정보를 콘솔에 출력합니다
 */
async function logChannelStates() {
  try {
    const channelStates = await getAllChannelStates();
    logger.info("CHANNELS", "======= 채널 상태 정보 =======");

    if (channelStates.length === 0) {
      logger.info("CHANNELS", "저장된 채널 상태 정보가 없습니다.");
    } else {
      channelStates.forEach((state) => {
        logger.info(
          "CHANNELS",
          `${state.channel_name || "이름 없음"} (${
            state.channel_id
          }): 마지막 읽은 시간 - ${new Date(
            parseInt(state.last_read_ts.split(".")[0]) * 1000
          ).toLocaleString()}`
        );
      });
    }

    logger.info("CHANNELS", "=============================");
  } catch (error) {
    logger.error("CHANNELS", "채널 상태 로깅 중 오류 발생:", error);
  }
}

/**
 * 애플리케이션 초기화 및 실행
 */
async function initialize() {
  logger.info("INIT", "Slack 메시지 수집기 초기화 중...");

  // 환경 확인 (Docker 환경인지)
  const isDocker = fs.existsSync("/.dockerenv");
  if (isDocker) {
    process.env.RUNNING_IN_DOCKER = "true";
    logger.info("INIT", "Docker 환경에서 실행 중입니다.");

    // Docker 환경에서 디렉토리 권한 확인
    checkDirectoryPermissions();
  }

  // 설정 검증
  if (!validateConfig(config)) {
    logger.error("INIT", "설정 검증 실패. 애플리케이션을 종료합니다.");
    process.exit(1);
  }

  // 데이터베이스 연결 테스트
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error("INIT", "데이터베이스 연결에 실패했습니다. 프로그램을 종료합니다.");
    process.exit(1);
  }

  // 데이터베이스 스키마 초기화
  try {
    await initializeSchema();

    // 채널 상태 테이블 초기화
    const channelTableInitialized = await initChannelStateTable();
    if (channelTableInitialized) {
      logger.info("INIT", "채널 상태 테이블이 초기화되었습니다.");
    }
  } catch (error) {
    handleError(error, "스키마 초기화", "INIT");
    logger.warning("INIT", "스키마 초기화 실패. 기존 스키마를 사용합니다.");
  }

  // API 서버 시작 (API_ENABLE 환경변수가 true일 때만)
  if (config.API_ENABLE === "true") {
    startServer();
  }

  // 초기 실행
  await checkAllChannels();

  // 채널 상태 로깅
  await logChannelStates();

  // 정기적 실행 설정
  cron.schedule("*/30 * * * * *", () => {
    checkAllChannels();
  });

  // 정기적 상태 보고 (채널 상태 정보 포함)
  cron.schedule("0 */1 * * *", async () => {
    monitor.logStatus();
    await logChannelStates();
  });

  logger.info("INIT", "Slack 메시지 수집기가 시작되었습니다. 30초마다 채널을 확인합니다.");
}

/**
 * Docker 환경에서 중요 디렉토리들의 권한을 확인합니다
 */
function checkDirectoryPermissions() {
  const dirsToCheck = [
    { path: path.join(__dirname, "..", "downloads"), name: "downloads" },
    { path: path.join(__dirname, "..", "logs"), name: "logs" },
    { path: path.join(__dirname, "..", "backups"), name: "backups" },
    { path: path.join(__dirname), name: "src" },
  ];

  dirsToCheck.forEach((dir) => {
    try {
      // 디렉토리 존재 확인
      if (!fs.existsSync(dir.path)) {
        fs.mkdirSync(dir.path, { recursive: true });
        logger.info("INIT", `${dir.name} 디렉토리 생성 완료`);
      }

      // 쓰기 권한 테스트
      const testFile = path.join(dir.path, ".permissions_test");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      logger.info("INIT", `${dir.name} 디렉토리에 쓰기 권한 있음`);
    } catch (error) {
      logger.warning("INIT", `${dir.name} 디렉토리 권한 문제: ${error.message}`);
    }
  });
}

// 종료 처리
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

/**
 * 애플리케이션 정상 종료 처리
 */
async function gracefulShutdown() {
  logger.info("SHUTDOWN", "애플리케이션을 종료하는 중...");

  // 캐시 리소스 정리
  reservationCache.destroy();

  // 마지막 상태 로깅
  monitor.logStatus();

  logger.info("SHUTDOWN", "정상적으로 종료되었습니다.");
  process.exit(0);
}

// 애플리케이션 시작
initialize().catch((error) => {
  handleError(error, "애플리케이션 초기화", "INIT");
  process.exit(1);
});
