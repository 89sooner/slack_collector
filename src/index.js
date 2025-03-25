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
  standardizeData,
  handleError,
  monitor,
  reservationCache,
  createBackup,
  cleanOldBackups,
} = require("./utils");

const { parseYanoljaMessage } = require("./platforms/yanolja");
const { parseNaverBookingMessage } = require("./platforms/naverbooking");
const { parseAirbnbMessage } = require("./platforms/airbnb");
const { parseYeogiMessage } = require("./platforms/yeogi");
const { startServer } = require("./api/server");
const cron = require("node-cron");
const { createLogger } = require("./utils/logging/logger");

const logger = createLogger("SLACK_COLLECTOR");

/**
 * 특정 채널의 메시지를 처리합니다
 * @param {string} channelId - Slack 채널 ID
 * @param {Function} parseFunction - 해당 채널 메시지의 파싱 함수
 */
async function processMessages(channelId, parseFunction) {
  try {
    const lastReadTs = await getLastReadTs();
    const result = await getChannelHistory(channelId, lastReadTs);

    const newMessages = result.messages.reverse();
    if (newMessages.length === 0) {
      logger.info("FETCH", `채널 ${channelId}에 새 메시지가 없습니다.`);
      return;
    }

    logger.info("FETCH", `채널 ${channelId}에서 ${newMessages.length}개의 새 메시지를 처리합니다.`);

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
      await saveLastReadTs(newMessages[newMessages.length - 1].ts);
      logger.info(
        "TIMESTAMP",
        `채널 ${channelId}의 마지막 읽은 타임스탬프 업데이트: ${
          newMessages[newMessages.length - 1].ts
        }`
      );
    }
  } catch (error) {
    logger.error("FETCH", `채널 ${channelId} 처리 중 오류 발생:`, error);
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
    logMessageToFile(message);

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
      processMessages(config.CHANNEL_ID_YANOLJA, parseYanoljaMessage),
      processMessages(config.CHANNEL_ID_NAVER_BOOKING, parseNaverBookingMessage),
      processMessages(config.CHANNEL_ID_AIRBNB, parseAirbnbMessage),
      processMessages(config.CHANNEL_ID_YEOGI, parseYeogiMessage),
    ]);

    logger.info("CHECK", "모든 채널 확인 완료");
  } catch (error) {
    logger.error("CHECK", "채널 확인 중 오류 발생:", error);
  }
}

/**
 * 애플리케이션 초기화 및 실행
 */
async function initialize() {
  logger.info("INIT", "Slack 메시지 수집기 초기화 중...");

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

  // 정기적 실행 설정
  cron.schedule("*/30 * * * * *", () => {
    checkAllChannels();
  });

  // 정기적 상태 보고
  cron.schedule("0 */1 * * *", () => {
    monitor.logStatus();
  });

  logger.info("INIT", "Slack 메시지 수집기가 시작되었습니다. 30초마다 채널을 확인합니다.");
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
