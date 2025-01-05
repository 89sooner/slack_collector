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
  // Parse dates from content first
  const datePattern = /(\d{4}년\s+\d+월\s+\d+일\s+\([월화수목금토일]\))/g;
  const dates = text.match(datePattern);

  if (dates && dates.length >= 2) {
    result.체크인 = dates[0].trim();
    result.체크아웃 = dates[1].trim();
  } else {
    // Fallback to title parsing if content parsing fails
    const titleDateMatch = title.match(/(\d{4}년)?\s*(\d+월\s+\d+일)~(\d+일)/);
    if (titleDateMatch) {
      const year = titleDateMatch[1] || new Date().getFullYear() + "년";
      const startDate = titleDateMatch[2];
      const endDate = startDate.split("월")[0] + "월 " + titleDateMatch[3];

      result.체크인 = `${year} ${startDate}`.trim();
      result.체크아웃 = `${year} ${endDate}`.trim();
    }
  }

  // Enhanced content parsing
  let checkInSection = false;
  let checkOutSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for date in the content
    const dateMatch = line.match(DATE_PATTERN);
    const timeMatch = line.match(TIME_PATTERN);

    if (line.includes("체크인")) {
      checkInSection = true;
      checkOutSection = false;
      continue;
    } else if (line.includes("체크아웃")) {
      checkInSection = false;
      checkOutSection = true;
      continue;
    }

    if (dateMatch) {
      if (checkInSection) {
        result.체크인 = line;
      } else if (checkOutSection) {
        result.체크아웃 = line;
      }
    }

    if (timeMatch) {
      if (checkInSection) {
        result.체크인시간 = line;
      } else if (checkOutSection) {
        result.체크아웃시간 = line;
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

  // Enhanced reservation status parsing
  if (title.includes("취소됨") || title.includes("취소되었습니다")) {
    parsedContent.예약상태 = "예약취소";
  } else if (title.includes("대기 중") || title.includes("예약 요청")) {
    parsedContent.예약상태 = "예약대기";
  } else if (title.includes("예약 확정") || title.includes("체크인할 예정입니다")) {
    parsedContent.예약상태 = "예약확정";
  } else {
    parsedContent.예약상태 = "알수없음";
  }

  // Enhanced guest name parsing
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
  const accommodationMatch = text.match(/L카이브L\s+스위트\s+NO\.9\s+송정점\s+\(\s*55평대\s*\)/i);
  if (accommodationMatch) {
    parsedContent.숙소명 = accommodationMatch[0].trim();
  }

  // Parse check-in/out info
  const checkInOutInfo = parseCheckInOut(text, title);
  Object.assign(parsedContent, checkInOutInfo);

  // Enhanced reservation number parsing
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

  // Enhanced URL parsing
  const urlMatch = text.match(/https:\/\/www\.airbnb\.co\.kr\/hosting\/reservations\/details\/\w+/);
  if (urlMatch) {
    parsedContent.예약상세URL = urlMatch[0];
  }

  // Enhanced guest count parsing
  const guestsMatch = text.match(/성인\s+(\d+)명/);
  if (guestsMatch) {
    parsedContent.예약인원 = guestsMatch[1];
  }

  // Enhanced payment info parsing
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

  return parsedContent;
}

module.exports = { parseAirbnbMessage };
