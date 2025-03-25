const { createLogger } = require("../logging/logger");

const logger = createLogger("FORMAT_HANDLER");

function extractNumber(value) {
  if (value) {
    return parseFloat(value.replace(/[^0-9.-]+/g, ""));
  }
  return 0;
}

/**
 * 문자열을 날짜 객체로 파싱
 * @param {string} dateStr - 파싱할 날짜 문자열
 * @returns {Date|null} - 파싱된 Date 객체 또는 null
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    // 여러 형식의 날짜 처리
    // 1. YYYY-MM-DD 형식
    const isoPattern = /(\d{4})-(\d{2})-(\d{2})/;
    // 2. YYYY.MM.DD 형식
    const dotPattern = /(\d{4})\.(\d{2})\.(\d{2})/;
    // 3. YYYY년 MM월 DD일 형식
    const koreanPattern = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;

    let year, month, day;

    if (isoPattern.test(dateStr)) {
      const match = dateStr.match(isoPattern);
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1; // JavaScript 월은 0부터 시작
      day = parseInt(match[3], 10);
    } else if (dotPattern.test(dateStr)) {
      const match = dateStr.match(dotPattern);
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1;
      day = parseInt(match[3], 10);
    } else if (koreanPattern.test(dateStr)) {
      const match = dateStr.match(koreanPattern);
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1;
      day = parseInt(match[3], 10);
    } else {
      // 다른 형식은 일단 Date 객체에 맡김
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
      return null;
    }

    return new Date(year, month, day);
  } catch (error) {
    logger.error("PARSE_DATE", `날짜 파싱 오류 (${dateStr}):`, error);
    return null;
  }
}

// 날짜 형식 변환 함수
function formatDate(platform, dateStr, status) {
  if (!dateStr) return null; // 날짜 문자열이 없는 경우 처리

  try {
    if (platform === "에어비앤비") {
      const standardPattern = /(\d+)월\s+(\d+)일\s*\([월화수목금토일]\)/;
      // 새로운 형식 (예: "2025년 2월 16일")
      const alternatePattern = /(\d{4})년\s+(\d+)월\s+(\d+)일/;

      let match = dateStr.match(standardPattern);
      if (match) {
        const currentYear = new Date().getFullYear();
        const month = match[1].padStart(2, "0");
        const day = match[2].padStart(2, "0");
        return `${currentYear}-${month}-${day}`;
      }

      match = dateStr.match(alternatePattern);
      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, "0");
        const day = match[3].padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    } else if (platform === "야놀자") {
      const yanoljaDateFormat = /(\d{4})-(\d{2})-(\d{2})\(.\)/;
      const match = dateStr.match(yanoljaDateFormat);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    } else if (platform === "네이버") {
      const naverBookingDateFormat = /(\d{4})\.(\d{2})\.(\d{2})/;
      const match = dateStr.match(naverBookingDateFormat);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    } else if (platform === "여기어때") {
      const yeogiDateFormat = /(\d{4})-(\d{2})-(\d{2}) \(.\)/;
      const match = dateStr.match(yeogiDateFormat);
      if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
  } catch (error) {
    logger.error("FORMAT_DATE", `Error formatting date: ${dateStr}`, error);
    return null;
  }
  return "";
}

// 객실명 형식 변환 함수
function formatRoomName(platform, roomName, accommodationName) {
  if (platform === "에어비앤비") {
    if (accommodationName) {
      // 브랜드명 표기 표준화
      return accommodationName
        .replace(/([LlIi]{1,2})카이브([LlIi]{1,2})/i, (match, prefix, suffix) => {
          // 첫 번째 l/L과 두 번째 l/L 각각의 길이를 체크
          const prefixLength = prefix.length;
          const suffixLength = suffix.length;

          // 길이에 따른 표준화
          let standardPrefix = prefixLength > 1 ? "LL" : "L";
          let standardSuffix = suffixLength > 1 ? "LL" : "L";

          return `${standardPrefix}카이브${standardSuffix}`;
        })
        .replace(/평형/, "평대"); // 평형 표기 통일
    }
    return "";
  } else if (platform === "야놀자") {
    // const yanoljaRoomNameFormat = /(.+) \(입실 \d+시, \d+평형\)/;
    const yanoljaRoomNameFormat = /(.+?)(?:\s*\(.*(?:입실\s*\d+시)?.*(?:\d+평형)?\))?$/;
    const match = roomName.match(yanoljaRoomNameFormat);
    if (match) {
      return match[1].trim();
    }
  } else if (platform === "여기어때") {
    return roomName;
  } else if (platform === "네이버") {
    return roomName;
  }
  return "";
}

// 게스트 이름 형식 변환 함수
function formatGuestName(platform, guestName) {
  if (platform === "에어비앤비") {
    return guestName.replace(/예약 확정 - /, "");
  }
  return guestName;
}

// 메시지 수신날짜 KTC 형식 변환 함수
function formatTsKoreaTime(tsKoreaTime) {
  const dateFormat = /(\d{4})\. (\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2}):(\d{2})/;
  const match = tsKoreaTime.match(dateFormat);
  if (match) {
    const [_, year, month, day, ampm, hour, minute, second] = match;
    let formattedHour = parseInt(hour, 10);
    if (ampm === "오후" && formattedHour < 12) {
      formattedHour += 12;
    } else if (ampm === "오전" && formattedHour === 12) {
      formattedHour = 0;
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${formattedHour
      .toString()
      .padStart(2, "0")}:${minute}:${second}`;
  }
  return tsKoreaTime;
}

module.exports = {
  extractNumber,
  formatDate,
  formatRoomName,
  formatGuestName,
  formatTsKoreaTime,
  parseDate,
};
