const { createLogger } = require("./logger");
const logger = createLogger("FORMAT_HANDLER");

function extractNumber(value) {
  if (value) {
    return parseFloat(value.replace(/[^0-9.-]+/g, ""));
  }
  return 0;
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

module.exports = { extractNumber, formatDate, formatRoomName, formatGuestName, formatTsKoreaTime };
