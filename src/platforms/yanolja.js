/**
 * 야놀자 예약 메시지 파싱 모듈
 */
const { createLogger } = require("../utils/logging/logger");
const logger = createLogger("YANOLJA");

/**
 * 파싱된 콘텐츠의 유효성을 검사하고 로깅합니다
 * @param {Object} parsedContent - 파싱된 야놀자 데이터
 * @returns {boolean} 유효성 검사 결과
 */
function validateAndLogParsedContent(parsedContent) {
  const commonRequiredFields = [
    "receivedDate", // 수신날짜
    "senderNumber", // 발신번호
    "senderName", // 발신자
    "receiverNumber", // 수신번호
    "receiverName", // 수신자
    "reservationStatus", // 예약상태
    "pensionName", // 펜션명
    "reservationNumber", // 예약번호
    "guestName", // 예약자
    "roomName", // 객실명
    "checkInDay", // 입실일
    "checkOutDay", // 퇴실일
    "stayDuration", // 이용기간
    "sellingPrice", // 판매가격
  ];

  const statusSpecificFields = {
    예약확정: ["pickupStatus", "phoneNumber"], // 픽업여부, 연락처
    예약취소: [],
    기타: ["phoneNumber"], // 연락처
  };

  let requiredFields = [...commonRequiredFields];
  if (statusSpecificFields[parsedContent.reservationStatus]) {
    requiredFields = [...requiredFields, ...statusSpecificFields[parsedContent.reservationStatus]];
  }

  let isValid = true;

  logger.warning("PARSING", `[야놀자] 예약번호: ${parsedContent.reservationNumber}`);
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
    receivedDate: "", // 수신날짜
    senderNumber: "", // 발신번호
    senderName: "", // 발신자
    receiverNumber: "", // 수신번호
    receiverName: "", // 수신자
    reservationStatus: "", // 예약상태
    pensionName: "", // 펜션명
    reservationNumber: "", // 예약번호
    guestName: "", // 예약자
    phoneNumber: "", // 연락처
    roomName: "", // 객실명
    checkInDay: "", // 입실일
    checkOutDay: "", // 퇴실일
    stayDuration: "", // 이용기간
    sellingPrice: "", // 판매가격
    pickupStatus: "", // 픽업여부
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
      parsedContent.receivedDate = line.split("]")[1].trim();
    } else if (line.includes("[발신번호]")) {
      const parts = line.split("]")[1].split("(");
      parsedContent.senderNumber = parts[0].trim();
      parsedContent.senderName = parts[1] ? parts[1].replace(")", "").trim() : "";
    } else if (line.includes("[수신번호]")) {
      const parts = line.split("]")[1].split("[");
      parsedContent.receiverNumber = parts[0].trim();
      parsedContent.receiverName = parts[1] ? parts[1].replace("]", "").trim() : "";
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
    if (line.includes("<숙박>")) {
      parsedContent.reservationStatus = "예약확정";
    } else if (line.includes("<숙박 취소>")) {
      parsedContent.reservationStatus = "예약취소";
    } else if (line.includes("[야놀자펜션 - ")) {
      // 기존 형식 지원 유지
      if (line.includes("예약완료")) {
        parsedContent.reservationStatus = "예약확정";
      } else if (line.includes("예약취소")) {
        parsedContent.reservationStatus = "예약취소";
      } else {
        parsedContent.reservationStatus = "기타";
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
  // 1. 기존 필드 매핑 유지 (이전 형식과의 호환성)
  const oldFieldMappings = {
    "펜션명 :": "pensionName",
    "야놀자펜션 예약번호 :": "reservationNumber",
    "예약자 :": "guestName",
    "연락처 :": "phoneNumber",
    "객실명 :": "roomName",
    "입실일 :": "checkInDay",
    "퇴실일 :": "checkOutDay",
    "이용기간:": "stayDuration",
    "판매가격:": "sellingPrice",
    "픽업여부:": "pickupStatus",
  };

  // 2. 새로운 메시지 형식 처리
  let currentLineIndex = 0;

  while (currentLineIndex < lines.length) {
    const line = lines[currentLineIndex];

    // 기존 형식 처리
    for (const [prefix, field] of Object.entries(oldFieldMappings)) {
      if (line.includes(prefix)) {
        parsedContent[field] = line.split(":")[1]?.trim() || "";
        break;
      }
    }

    // 새 형식 처리 - 미리예약 메시지 찾기
    if (line.includes("야놀자 미리예약")) {
      let contentStart = false;

      // 예약정보 시작 이후의 라인들 파싱
      for (let i = currentLineIndex; i < lines.length; i++) {
        const contentLine = lines[i];

        // 펜션명 파싱 (첫 번째 내용 라인)
        if (
          contentStart === false &&
          (contentLine.includes("<숙박>") || contentLine.includes("<숙박 취소>"))
        ) {
          contentStart = true;
          continue;
        }

        if (contentStart) {
          // 펜션명
          if (i === currentLineIndex + 2) {
            parsedContent.pensionName = contentLine.trim();
          }
          // 예약번호
          else if (i === currentLineIndex + 3) {
            parsedContent.reservationNumber = contentLine.trim();
          }
          // 객실명
          else if (i === currentLineIndex + 4) {
            parsedContent.roomName = contentLine.trim();
          }
          // 가격
          else if (i === currentLineIndex + 5) {
            parsedContent.sellingPrice = contentLine.trim();
          }
          // 예약자/연락처
          else if (i === currentLineIndex + 6 && contentLine.includes("/")) {
            const parts = contentLine.split("/");
            parsedContent.guestName = parts[0].trim();
            parsedContent.phoneNumber = parts[1].trim();
          }
          // 체크인 정보
          else if (i === currentLineIndex + 7 && contentLine.includes("~")) {
            const checkInMatch = contentLine.match(/(\d{4}-\d{2}-\d{2})\(.\) (\d{2}:\d{2})~/);
            if (checkInMatch) {
              parsedContent.checkInDay = checkInMatch[1];
            }
          }
          // 체크아웃 정보
          else if (i === currentLineIndex + 8 && contentLine.includes("(")) {
            const checkOutMatch = contentLine.match(
              /(\d{4}-\d{2}-\d{2})\(.\) (\d{2}:\d{2}) \((\d+)박\)/
            );
            if (checkOutMatch) {
              parsedContent.checkOutDay = checkOutMatch[1];
              parsedContent.stayDuration = checkOutMatch[3] + "박";
            }
          }
          // 픽업정보
          else if (i === currentLineIndex + 9) {
            parsedContent.pickupStatus = contentLine.trim();
          }
        }
      }
    }

    currentLineIndex++;
  }
}

module.exports = { parseYanoljaMessage };
