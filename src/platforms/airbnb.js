const { createLogger } = require("../utils/logger");
const logger = createLogger("AIRBNB");

function validateAndLogParsedContent(parsedContent, title) {
  const commonRequiredFields = [
    "예약상태",
    "숙소명",
    "예약번호",
    "게스트",
    "예약상세URL",
    "메시지",
    "예약인원",
    "총결제금액",
    "호스트수익",
    "서비스수수료",
  ];

  const statusSpecificFields = {
    예약확정: ["체크인", "체크아웃", "체크인시간", "체크아웃시간"],
    예약대기: ["체크인", "체크아웃", "체크인시간", "체크아웃시간"],
    예약취소: [],
  };

  let requiredFields = [...commonRequiredFields];
  if (statusSpecificFields[parsedContent.예약상태]) {
    requiredFields = [...requiredFields, ...statusSpecificFields[parsedContent.예약상태]];
  }

  let isValid = true;

  logger.warning("PARSING", `[에어비앤비] Title: ${title}`);
  requiredFields.forEach((field) => {
    if (!parsedContent[field]) {
      logger.warning("PARSING", `Warning: ${field} is empty or missing`);
      isValid = false;
    }
  });

  return isValid;
}

async function parseAirbnbMessage(message) {
  if (message.files && message.files.length > 0) {
    const file = message.files[0];
    try {
      const parsedContent = parseMessageContent(file, file.title);
      validateAndLogParsedContent(parsedContent, file.title);
      return parsedContent;
    } catch (error) {
      logger.error("PARSING", "Falling back to plain text parsing:", error);
      return null;
    }
  }
  logger.info("PARSING", "No files found in the message");
  return null;
}

const DATE_PATTERN = /(\d{4}년\s+)?(\d+월\s+\d+일)/;
const TIME_PATTERN = /^(오전|오후)\s+\d+:\d+$/;

function parseCheckInOut(text, title) {
  const lines = text.split(/\r\n|\n/).map((line) => line.trim());
  const result = {
    체크인: "",
    체크아웃: "",
    체크인시간: "오후 4:00", // 기본값 설정
    체크아웃시간: "오전 11:00", // 기본값 설정
  };

  // 연도가 포함된 날짜 형식 처리
  const fullDatePattern = /(\d{4}년\s+\d+월\s+\d+일\s+\([월화수목금토일]\))/g;
  const dates = text.match(fullDatePattern);
  if (dates && dates.length >= 2) {
    result.체크인 = dates[0].trim();
    result.체크아웃 = dates[1].trim();
  } else {
    // 날짜 범위 패턴 처리
    const dateRangePattern = /(\d+월\s+\d+일)\s*\([월화수목금토일]\)\s*(?:~|   )\s*(\d+월\s+\d+일)/;
    const rangeMatch = text.match(dateRangePattern);
    if (rangeMatch) {
      const year = new Date().getFullYear() + "년";
      result.체크인 = `${year} ${rangeMatch[1].trim()}`;
      result.체크아웃 = `${year} ${rangeMatch[2].trim()}`;
    } else {
      // 타이틀에서 날짜 추출 시도
      const titleDateMatch = title.match(/(\d{4}년)?\s*(\d+월\s+\d+일)~(\d+일)/);
      if (titleDateMatch) {
        const year = titleDateMatch[1] || new Date().getFullYear() + "년";
        const month = titleDateMatch[2].split("월")[0] + "월";
        result.체크인 = `${year} ${titleDateMatch[2]}`;
        result.체크아웃 = `${year} ${month} ${titleDateMatch[3]}`;
      }
    }
  }
  return result;
}

function parseMessageContent(file, title) {
  const text = file.plain_text;
  let parsedContent = {
    platform: "에어비앤비",
    예약상태: "",
    숙소명: "",
    체크인: "",
    체크아웃: "",
    예약번호: "",
    게스트: "",
    예약상세URL: "",
    메시지: "",
    예약인원: "",
    총결제금액: "",
    호스트수익: "",
    서비스수수료: "",
    체크인시간: "",
    체크아웃시간: "",
  };

  // 공통 숙소명 파싱 함수
  function parseAccommodationName(text) {
    const prefix = "(?:일광\\d+층\\s*·\\s*)?"; // Optional floor prefix
    const nameBase = "(?:[LlI]{1,2})카이브(?:[LlI]{1,2})"; // Captures L/l variations
    const locations = "(?:해운대\\s+)?(?:송정|기장일광|일광)점"; // Updated location pattern
    const sizePattern = "\\(\\s*\\d+평[형대]\\s*\\)";

    const patterns = [
      // Pattern 1: Standard suite format with optional area prefix
      new RegExp(
        `${prefix}${nameBase}\\s+스위트\\s+[Nn][Oo]\\.?\\d+\\s+${locations}\\s*${sizePattern}`,
        "i"
      ),

      // Pattern 2: Ryokan suite format with optional area prefix
      new RegExp(
        `${prefix}${nameBase}\\s+료칸스위트\\s+[Nn][Oo]\\.?\\d+\\s+${locations}\\s*${sizePattern}`,
        "i"
      ),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Standardize the format and replace 평형 with 평대
        return match[0].replace(/평형/, "평대").trim();
      }
    }
    return "";
  }

  // Enhanced reservation status parsing
  if (title.includes("취소됨") || title.includes("취소되었습니다")) {
    parsedContent.예약상태 = "예약취소";
  } else if (title.includes("대기 중") || title.includes("예약 요청")) {
    parsedContent.예약상태 = "예약대기";
  } else if (title.includes("예약 확정") || title.includes("체크인할 예정입니다")) {
    parsedContent.예약상태 = "예약확정";
  }

  if (parsedContent.예약상태 == "예약취소") {
    // 숙소명 파싱 개선
    parsedContent.숙소명 = parseAccommodationName(text);

    // 예약번호 파싱 개선
    const reservationNumberMatch = text.match(/예약\(([A-Z0-9]+)\)/);
    if (reservationNumberMatch) {
      parsedContent.예약번호 = reservationNumberMatch[1];
    }

    // 게스트 정보 파싱 개선
    const guestMatch = text.match(/게스트\s+([^\s]+)\s+님이/);
    if (guestMatch) {
      parsedContent.게스트 = guestMatch[1];
    }

    // 예약 인원 파싱
    const guestsMatch = text.match(/숙박\s+인원\s+(\d+)\s*명/);
    if (guestsMatch) {
      parsedContent.예약인원 = guestsMatch[1];
    }

    // 호스트 수익 파싱
    const amountMatch = text.match(/변경\s+후\s+금액:\s*₩([\d,]+)/);
    if (amountMatch) {
      parsedContent.호스트수익 = amountMatch[1];
    }

    // URL 파싱 개선
    const urlMatch = text.match(/https:\/\/www\.airbnb\.co\.kr\/hosting\/reservations\/[^\s]+/);
    if (urlMatch) {
      parsedContent.예약상세URL = urlMatch[0];
    }

    // 체크인/아웃 날짜 파싱 개선
    // 체크인/아웃 날짜 파싱 개선
    const cancelDatePattern = /(\d{4}년)?\s*(\d+월\s+\d+일)(?:~|\s+)?(\d+월\s+\d+일|\d+일)/;
    const dateMatch = text.match(cancelDatePattern);

    if (dateMatch) {
      const year = dateMatch[1] || new Date().getFullYear() + "년";
      const checkInDate = dateMatch[2];
      let checkOutDate = dateMatch[3];

      // 체크아웃 날짜가 일자만 있는 경우 월 정보 추가
      if (!checkOutDate.includes("월")) {
        const checkInMonth = checkInDate.split("월")[0] + "월";
        checkOutDate = checkInMonth + " " + checkOutDate;
      }

      parsedContent.체크인 = `${year} ${checkInDate}`;
      parsedContent.체크아웃 = `${year} ${checkOutDate}`;
    } else {
      // 전체 날짜 형식으로 된 경우 처리
      const fullDatePattern = /(\d{4}년\s+\d+월\s+\d+일)/g;
      const dates = text.match(fullDatePattern);
      if (dates && dates.length >= 2) {
        parsedContent.체크인 = dates[0];
        parsedContent.체크아웃 = dates[1];
      }
    }
  } else {
    // 게스트 정보 파싱
    const guestPatterns = [
      /게스트\s+(.+)\s+님이.*예약.*취소했습니다/,
      /(.+)님에게\s+메시지를\s+보내\s+체크인/,
      /(.+)님의\s+예약\s+요청에\s+답하세요/,
      /(.+)\s+님이.*체크인할\s+예정입니다/,
    ];

    for (const pattern of guestPatterns) {
      const match = text.match(pattern);
      if (match) {
        parsedContent.게스트 = match[1].trim();
        break;
      }
    }

    // Enhanced accommodation name parsing
    parsedContent.숙소명 = parseAccommodationName(text);

    // 체크인/아웃 정보 파싱
    const checkInOutInfo = parseCheckInOut(text, title);
    Object.assign(parsedContent, checkInOutInfo);

    // 예약번호 파싱
    const reservationNumberPatterns = [
      /예약\s+번호\s*\r?\n\s*(\w+)/,
      /예약\s*번호[:\s]+(\w+)/,
      /reservations\/details\/(\w+)/,
    ];

    for (const pattern of reservationNumberPatterns) {
      const match = text.match(pattern);
      if (match) {
        parsedContent.예약번호 = match[1];
        break;
      }
    }

    // URL 파싱
    const urlMatch = text.match(
      /https:\/\/www\.airbnb\.co\.kr\/hosting\/reservations\/details\/\w+/
    );
    if (urlMatch) {
      parsedContent.예약상세URL = urlMatch[0];
    }

    // 예약 인원 파싱
    const guestsMatch = text.match(/성인\s+(\d+)명/);
    if (guestsMatch) {
      parsedContent.예약인원 = guestsMatch[1];
    }

    // 결제 정보 파싱
    const paymentMatches = {
      총결제금액: /총\s+금액\(KRW\)\s+₩([\d,]+)/,
      호스트수익: /호스트\s+수익\s+₩([\d,]+)/,
      서비스수수료: /호스트\s+서비스\s+수수료\([^)]+\)\s+-₩([\d,]+)/,
    };

    for (const [field, pattern] of Object.entries(paymentMatches)) {
      const match = text.match(pattern);
      if (match) {
        parsedContent[field] = match[1];
      }
    }
  }

  // 체크인/아웃 시간 기본값 설정
  if (!parsedContent.체크인시간) parsedContent.체크인시간 = "오후 4:00";
  if (!parsedContent.체크아웃시간) parsedContent.체크아웃시간 = "오전 11:00";

  return parsedContent;
}

module.exports = { parseAirbnbMessage };
