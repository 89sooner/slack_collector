/**
 * 야놀자 예약 메시지 파싱 모듈
 */
const { createLogger } = require("../utils/logger");
const logger = createLogger("YANOLJA");

/**
 * 파싱된 콘텐츠의 유효성을 검사하고 로깅합니다
 * @param {Object} parsedContent - 파싱된 야놀자 데이터
 * @returns {boolean} 유효성 검사 결과
 */
function validateAndLogParsedContent(parsedContent) {
  const commonRequiredFields = [
    "수신날짜",
    "발신번호",
    "발신자",
    "수신번호",
    "수신자",
    "예약상태",
    "펜션명",
    "예약번호",
    "예약자",
    "객실명",
    "입실일",
    "퇴실일",
    "이용기간",
    "판매가격",
  ];

  const statusSpecificFields = {
    예약확정: ["픽업여부", "연락처"],
    예약취소: [],
    기타: ["연락처"],
  };

  let requiredFields = [...commonRequiredFields];
  if (statusSpecificFields[parsedContent.예약상태]) {
    requiredFields = [...requiredFields, ...statusSpecificFields[parsedContent.예약상태]];
  }

  let isValid = true;

  logger.warning("PARSING", `[야놀자] 예약번호: ${parsedContent.예약번호}`);
  requiredFields.forEach((field) => {
    if (!parsedContent[field]) {
      logger.warning("PARSING", `Warning: ${field} is empty or missing`);
      isValid = false;
    }
  });

  return isValid;
}

/**
 * 야놀자 메시지를 파싱합니다
 * @param {Object} message - Slack 메시지 객체
 * @returns {Promise<Object|null>} 파싱된 야놀자 데이터 또는 null
 */
async function parseYanoljaMessage(message) {
  try {
    if (!message.text) {
      logger.info("PARSING", "텍스트가 없는 메시지입니다");
      return null;
    }

    const parsedContent = parseMessageContent(message.text);
    validateAndLogParsedContent(parsedContent);
    return parsedContent;
  } catch (error) {
    logger.error("PARSING", "야놀자 메시지 파싱 중 오류:", error);
    return null;
  }
}

/**
 * 메시지 내용을 파싱합니다
 * @param {string} text - 파싱할 텍스트
 * @returns {Object} 파싱된 야놀자 데이터
 */
function parseMessageContent(text) {
  const lines = text.split("\n");
  let parsedContent = {
    platform: "야놀자",
    수신날짜: "",
    발신번호: "",
    발신자: "",
    수신번호: "",
    수신자: "",
    예약상태: "",
    펜션명: "",
    예약번호: "",
    예약자: "",
    연락처: "",
    객실명: "",
    입실일: "",
    퇴실일: "",
    이용기간: "",
    판매가격: "",
    픽업여부: "",
  };

  // 헤더 정보 파싱
  parseHeaderInfo(lines, parsedContent);

  // 예약 상태 파싱
  parseReservationStatus(lines, parsedContent);

  // 예약 상세 정보 파싱
  parseReservationDetails(lines, parsedContent);

  return parsedContent;
}

/**
 * 헤더 정보를 파싱합니다
 * @param {Array} lines - 텍스트 라인 배열
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseHeaderInfo(lines, parsedContent) {
  lines.forEach((line) => {
    if (line.includes("[수신날짜]")) {
      parsedContent.수신날짜 = line.split("]")[1].trim();
    } else if (line.includes("[발신번호]")) {
      const parts = line.split("]")[1].split("(");
      parsedContent.발신번호 = parts[0].trim();
      parsedContent.발신자 = parts[1] ? parts[1].replace(")", "").trim() : "";
    } else if (line.includes("[수신번호]")) {
      const parts = line.split("]")[1].split("[");
      parsedContent.수신번호 = parts[0].trim();
      parsedContent.수신자 = parts[1] ? parts[1].replace("]", "").trim() : "";
    }
  });
}

/**
 * 예약 상태를 파싱합니다
 * @param {Array} lines - 텍스트 라인 배열
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseReservationStatus(lines, parsedContent) {
  lines.forEach((line) => {
    if (line.includes("[야놀자펜션 - ")) {
      if (line.includes("예약완료")) {
        parsedContent.예약상태 = "예약확정";
      } else if (line.includes("예약취소")) {
        parsedContent.예약상태 = "예약취소";
      } else {
        parsedContent.예약상태 = "알수없음";
      }
    }
  });
}

/**
 * 예약 상세 정보를 파싱합니다
 * @param {Array} lines - 텍스트 라인 배열
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseReservationDetails(lines, parsedContent) {
  const fieldMappings = {
    "펜션명 :": "펜션명",
    "야놀자펜션 예약번호 :": "예약번호",
    "예약자 :": "예약자",
    "연락처 :": "연락처",
    "객실명 :": "객실명",
    "입실일 :": "입실일",
    "퇴실일 :": "퇴실일",
    "이용기간:": "이용기간",
    "판매가격:": "판매가격",
    "픽업여부:": "픽업여부",
  };

  lines.forEach((line) => {
    for (const [prefix, field] of Object.entries(fieldMappings)) {
      if (line.includes(prefix)) {
        parsedContent[field] = line.split(":")[1].trim();
        break;
      }
    }
  });
}

module.exports = { parseYanoljaMessage };
