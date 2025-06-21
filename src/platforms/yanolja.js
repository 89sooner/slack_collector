/**
 * 야놀자 예약 메시지 파싱 모듈
 */
const { createLogger } = require("../utils/logging/logger");
const logger = createLogger("YANOLJA");

/**
 * HTML 엔티티를 디코딩합니다
 * @param {string} text - 디코딩할 텍스트
 * @returns {string} 디코딩된 텍스트
 */
function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

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

    // HTML 엔티티 디코딩
    const decodedText = decodeHtmlEntities(message.text);
    logger.debug("PARSING", "디코딩된 텍스트 처리", {
      originalLength: message.text.length,
      decodedLength: decodedText.length,
    });

    const parsedContent = parseMessageContent(decodedText);
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
  // 모든 라인을 가져오고, 빈 라인은 필터링
  const allLines = text.split("\n");
  const lines = allLines.map((line) => line.trim()).filter((line) => line !== "");

  logger.debug("PARSING", `전체 라인 수: ${allLines.length}, 유효 라인 수: ${lines.length}`);

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

  // 예약 상세 정보 파싱 (패턴 기반으로 변경)
  parseReservationDetailsByPattern(lines, parsedContent);

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
  logger.debug("PARSING", "예약 상태 파싱 시작");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 숙박, 숙박 취소, 연박 패턴 확인
    if (line === "<숙박>" || line === "<연박>") {
      parsedContent.reservationStatus = "예약확정";
      logger.debug("PARSING", `예약 상태 확인: 예약확정 (${line})`);
      return;
    } else if (line === "<숙박 취소>") {
      parsedContent.reservationStatus = "예약취소";
      logger.debug("PARSING", "예약 상태 확인: 예약취소");
      return;
    } else if (line.includes("[야놀자펜션 - ")) {
      // 기존 형식 지원 유지
      if (line.includes("예약완료")) {
        parsedContent.reservationStatus = "예약확정";
      } else if (line.includes("예약취소")) {
        parsedContent.reservationStatus = "예약취소";
      } else {
        parsedContent.reservationStatus = "기타";
      }
      logger.debug("PARSING", `기존 형식 예약 상태: ${parsedContent.reservationStatus}`);
      return;
    }
  }

  logger.warning("PARSING", "예약 상태를 결정할 수 없습니다");
}

/**
 * 기존 예약 상세 정보를 파싱합니다(이전 호환성용)
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

/**
 * 패턴 기반으로 예약 상세 정보를 파싱합니다
 * @param {Array} lines - 텍스트 라인 배열
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseReservationDetailsByPattern(lines, parsedContent) {
  logger.debug("PARSING", "패턴 기반 예약 상세 정보 파싱 시작");

  // 기존 형식을 위한 필드 매핑
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

  // 1. 기존 필드 매핑 처리
  for (const line of lines) {
    for (const [prefix, field] of Object.entries(oldFieldMappings)) {
      if (line.includes(prefix)) {
        parsedContent[field] = line.split(":")[1]?.trim() || "";
        logger.debug("PARSING", `기존 형식 파싱: ${field} = ${parsedContent[field]}`);
      }
    }
  }

  // 2. 새로운 메시지 형식 처리 (패턴 기반)
  // 예약 구조 마커 찾기
  let bookingTypeIndex = -1;
  let miriReservationIndex = -1;

  // (1) 미리예약 위치 찾기
  for (let i = 0; i < lines.length; i++) {
    // "야놀자 미리예약" 또는 "NOL 미리예약" 모두 허용
    if (lines[i] === "야놀자 미리예약" || lines[i] === "NOL 미리예약") {
      miriReservationIndex = i;
      logger.debug("PARSING", `미리예약 라인 찾음: ${i} (${lines[i]})`);
      break;
    }
  }

  // (2) 숙박, 숙박 취소, 연박 위치 찾기
  if (miriReservationIndex !== -1) {
    for (let i = miriReservationIndex + 1; i < lines.length; i++) {
      if (lines[i] === "<숙박>" || lines[i] === "<숙박 취소>" || lines[i] === "<연박>") {
        bookingTypeIndex = i;
        logger.debug("PARSING", `예약 타입 라인 찾음: ${i}, 값: ${lines[i]}`);
        break;
      }
    }
  }

  // 새 형식의 예약 정보 파싱
  if (bookingTypeIndex !== -1) {
    // 펜션명 (예약 타입 바로 다음 라인)
    if (bookingTypeIndex + 1 < lines.length) {
      parsedContent.pensionName = lines[bookingTypeIndex + 1];
      logger.debug("PARSING", `펜션명: ${parsedContent.pensionName}`);
    }

    // 예약번호 (펜션명 다음 라인)
    if (bookingTypeIndex + 2 < lines.length) {
      parsedContent.reservationNumber = lines[bookingTypeIndex + 2];
      logger.debug("PARSING", `예약번호: ${parsedContent.reservationNumber}`);
    }

    // 객실명 찾기: 예약번호 이후 첫 번째 의미있는 라인
    // (빈 줄을 감안해 반복 검색)
    for (let i = bookingTypeIndex + 3; i < lines.length; i++) {
      if (lines[i] && !parsedContent.roomName) {
        parsedContent.roomName = lines[i];
        logger.debug("PARSING", `객실명: ${parsedContent.roomName}`);
        break;
      }
    }

    // 가격 찾기: 원(₩) 또는 숫자+원 패턴 확인
    const pricePattern = /^([\d,]+)(원|₩)/;
    for (let i = bookingTypeIndex + 3; i < lines.length; i++) {
      if (pricePattern.test(lines[i])) {
        parsedContent.sellingPrice = lines[i];
        logger.debug("PARSING", `가격: ${parsedContent.sellingPrice}`);
        break;
      }
    }

    // 예약자 정보 찾기: 이름 / 번호 패턴
    const guestInfoPattern = /(.+)\s*\/\s*(\d+)/;
    for (let i = bookingTypeIndex + 4; i < lines.length; i++) {
      const match = lines[i].match(guestInfoPattern);
      if (match) {
        parsedContent.guestName = match[1].trim();
        parsedContent.phoneNumber = match[2].trim();
        logger.debug(
          "PARSING",
          `예약자: ${parsedContent.guestName}, 연락처: ${parsedContent.phoneNumber}`
        );
        break;
      }
    }

    // 체크인/체크아웃 정보 파싱 개선: 세 가지 포맷 모두 지원
    let checkInIndex = -1;
    let foundCheckIn = false;

    // 1. 신규 포맷: 체크인 라인 단독, 다음 라인이 ~로 시작하는 체크아웃
    const checkInPatternNew2 = /(\d{4}-\d{2}-\d{2})\(.\).*?(\d{2}:\d{2})$/;
    const checkOutPatternNew2 = /^~(\d{4}-\d{2}-\d{2})\(.\).*?(\d{2}:\d{2}) \((\d+)박\)/;

    // 2. 취소 포맷: 체크인 라인 끝에 ~, 다음 라인이 체크아웃 (~ 없음)
    const checkInPatternCancel = /(\d{4}-\d{2}-\d{2})\(.\).*?(\d{2}:\d{2})~$/;
    const checkOutPatternCancel = /^(\d{4}-\d{2}-\d{2})\(.\).*?(\d{2}:\d{2}) \((\d+)박\)/;

    // 3. 기존 포맷: 체크인 라인 끝에 ~, 다음 라인이 체크아웃
    const checkInPatternLegacy = /(\d{4}-\d{2}-\d{2})\(.\).*?(\d{2}:\d{2})~$/;
    const checkOutPatternLegacy = /^(\d{4}-\d{2}-\d{2})\(.\).*?(\d{2}:\d{2}) \((\d+)박\)/;

    for (let i = bookingTypeIndex + 5; i < lines.length; i++) {
      // 신규 포맷: 체크인 라인 단독, 다음 라인이 ~로 시작
      let match = lines[i].match(checkInPatternNew2);
      if (match && i + 1 < lines.length && lines[i + 1].startsWith("~")) {
        parsedContent.checkInDay = match[1];
        logger.debug("PARSING", `체크인(신규포맷): ${parsedContent.checkInDay}`);
        const outMatch = lines[i + 1].match(checkOutPatternNew2);
        if (outMatch) {
          parsedContent.checkOutDay = outMatch[1];
          parsedContent.stayDuration = outMatch[3] + "박";
          logger.debug(
            "PARSING",
            `체크아웃(신규포맷): ${parsedContent.checkOutDay}, 숙박: ${parsedContent.stayDuration}`
          );
        }
        foundCheckIn = true;
        break;
      }

      // 취소 포맷: 체크인 라인 끝에 ~, 다음 라인이 체크아웃 (~ 없음)
      match = lines[i].match(checkInPatternCancel);
      if (match && i + 1 < lines.length && !lines[i + 1].startsWith("~")) {
        parsedContent.checkInDay = match[1];
        logger.debug("PARSING", `체크인(취소포맷): ${parsedContent.checkInDay}`);
        const outMatch = lines[i + 1].match(checkOutPatternCancel);
        if (outMatch) {
          parsedContent.checkOutDay = outMatch[1];
          parsedContent.stayDuration = outMatch[3] + "박";
          logger.debug(
            "PARSING",
            `체크아웃(취소포맷): ${parsedContent.checkOutDay}, 숙박: ${parsedContent.stayDuration}`
          );
        }
        foundCheckIn = true;
        break;
      }

      // 기존 포맷: 체크인 라인 끝에 ~, 다음 라인이 체크아웃
      match = lines[i].match(checkInPatternLegacy);
      if (match) {
        parsedContent.checkInDay = match[1];
        logger.debug("PARSING", `체크인(기존포맷): ${parsedContent.checkInDay}`);
        checkInIndex = i;
        // 다음 라인에서 체크아웃 추출
        if (i + 1 < lines.length) {
          const outMatch = lines[i + 1].match(checkOutPatternLegacy);
          if (outMatch) {
            parsedContent.checkOutDay = outMatch[1];
            parsedContent.stayDuration = outMatch[3] + "박";
            logger.debug(
              "PARSING",
              `체크아웃(기존포맷): ${parsedContent.checkOutDay}, 숙박: ${parsedContent.stayDuration}`
            );
          }
        }
        foundCheckIn = true;
        break;
      }
    }

    // 기존 포맷(체크인/체크아웃이 한 줄씩 따로 있는 경우)도 지원 (백업)
    if (!foundCheckIn) {
      const legacyCheckInPattern = /(\d{4}-\d{2}-\d{2})\(.\) (\d{2}:\d{2})~/;
      for (let i = bookingTypeIndex + 5; i < lines.length; i++) {
        const match = lines[i].match(legacyCheckInPattern);
        if (match) {
          parsedContent.checkInDay = match[1];
          logger.debug("PARSING", `체크인(백업): ${parsedContent.checkInDay}`);
          break;
        }
      }
      const legacyCheckOutPattern = /(\d{4}-\d{2}-\d{2})\(.\) (\d{2}:\d{2}) \((\d+)박\)/;
      for (let i = bookingTypeIndex + 6; i < lines.length; i++) {
        const match = lines[i].match(legacyCheckOutPattern);
        if (match) {
          parsedContent.checkOutDay = match[1];
          parsedContent.stayDuration = match[3] + "박";
          logger.debug(
            "PARSING",
            `체크아웃(백업): ${parsedContent.checkOutDay}, 숙박: ${parsedContent.stayDuration}`
          );
          break;
        }
      }
    }

    // 픽업정보 찾기: 마지막 줄
    // 주로 "자가방문", "대중교통방문", "도보방문" 등의 형태로 나타남
    const transportKeywords = ["방문", "자가", "교통", "도보"];
    for (let i = lines.length - 1; i > bookingTypeIndex + 7; i--) {
      if (transportKeywords.some((keyword) => lines[i].includes(keyword))) {
        parsedContent.pickupStatus = lines[i].trim();
        logger.debug("PARSING", `픽업상태: ${parsedContent.pickupStatus}`);
        break;
      }
    }
  } else {
    logger.debug("PARSING", "새 형식 예약 마커를 찾을 수 없습니다. 기존 파싱 결과만 사용됩니다.");
  }

  // 파싱 결과 요약 출력
  logger.debug("PARSING_RESULT", "파싱 결과", parsedContent);
}

module.exports = { parseYanoljaMessage };
