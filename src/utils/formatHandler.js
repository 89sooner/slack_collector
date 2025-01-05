const { createLogger } = require("./logger");
const logger = createLogger("FORMAT_HANDLER");

function extractNumber(value) {
  if (value) {
    return parseFloat(value.replace(/[^0-9.-]+/g, ""));
  }
  return 0;
}

// 날짜 형식 변환 함수
function formatDate(platform, dateString, status) {
  if (platform === "에어비앤비") {
    if (status != "예약취소") {
      const airbnbDateFormat = /(\d+)월 (\d+)일 \(.\)/;
      const match = dateString.match(airbnbDateFormat);
      if (match) {
        const year = new Date().getFullYear();
        const month = match[1].padStart(2, "0");
        const day = match[2].padStart(2, "0");
        return `${year}-${month}-${day}`;
      } else {
        logger.error("FORMAT_DATE", `Airbnb date string did not match: ${dateString}`);
      }
    }
  } else if (platform === "야놀자") {
    const yanoljaDateFormat = /(\d{4})-(\d{2})-(\d{2})\(.\)/;
    const match = dateString.match(yanoljaDateFormat);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  } else if (platform === "네이버") {
    const naverBookingDateFormat = /(\d{4})\.(\d{2})\.(\d{2})/;
    const match = dateString.match(naverBookingDateFormat);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  } else if (platform === "여기어때") {
    const yeogiDateFormat = /(\d{4})-(\d{2})-(\d{2}) \(.\)/;
    const match = dateString.match(yeogiDateFormat);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  return "";
}

// 객실명 형식 변환 함수
function formatRoomName(platform, roomName, accommodationName) {
  if (platform === "에어비앤비") {
    return accommodationName || "";
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
