/**
 * 에어비앤비 예약 메시지 파싱 모듈
 */
const { createLogger } = require("../utils/logging/logger");
const logger = createLogger("AIRBNB");

/**
 * 파싱된 콘텐츠의 유효성을 검사하고 로깅합니다
 * @param {Object} parsedContent - 파싱된 에어비앤비 데이터
 * @param {string} title - 메시지 제목
 * @returns {boolean} 유효성 검사 결과
 */
function validateAndLogParsedContent(parsedContent, title) {
  const commonRequiredFields = [
    "reservationStatus", // 예약상태
    "accommodationName", // 숙소명
    "reservationNumber", // 예약번호
    "guestName", // 게스트
    "reservationDetailUrl", // 예약상세URL
    "message", // 메시지
    "guestCount", // 예약인원
    "totalAmount", // 총결제금액
    "hostEarnings", // 호스트수익
    "serviceFee", // 서비스수수료
  ];

  const statusSpecificFields = {
    예약확정: ["checkInDate", "checkOutDate", "checkInTime", "checkOutTime"], // 체크인, 체크아웃, 체크인시간, 체크아웃시간
    예약대기: ["checkInDate", "checkOutDate", "checkInTime", "checkOutTime"], // 체크인, 체크아웃, 체크인시간, 체크아웃시간
    예약취소: [],
  };

  let requiredFields = [...commonRequiredFields];
  if (statusSpecificFields[parsedContent.reservationStatus]) {
    requiredFields = [...requiredFields, ...statusSpecificFields[parsedContent.reservationStatus]];
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

/**
 * 에어비앤비 메시지를 파싱합니다
 * @param {Object} message - Slack 메시지 객체
 * @returns {Promise<Object|null>} 파싱된 에어비앤비 데이터 또는 null
 */
async function parseAirbnbMessage(message) {
  if (!message.files || message.files.length === 0) {
    logger.info("PARSING", "파일이 없는 메시지입니다");
    return null;
  }

  const file = message.files[0];
  try {
    const parsedContent = parseMessageContent(file, file.title);
    validateAndLogParsedContent(parsedContent, file.title);
    return parsedContent;
  } catch (error) {
    logger.error("PARSING", "에어비앤비 메시지 파싱 중 오류:", error);
    return null;
  }
}

/**
 * 체크인/체크아웃 정보를 파싱합니다
 * @param {string} text - 파싱할 전체 텍스트
 * @param {string} title - 메시지 제목
 * @returns {Object} 체크인/체크아웃 정보
 */
function parseCheckInOut(text, title) {
  const result = {
    checkInDate: "",
    checkOutDate: "",
    checkInTime: "오후 4:00", // 기본값 설정
    checkOutTime: "오전 11:00", // 기본값 설정
  };

  // 연도가 포함된 날짜 형식 처리
  const fullDatePattern = /(\d{4}년\s+\d+월\s+\d+일\s+\([월화수목금토일]\))/g;
  const dates = text.match(fullDatePattern);

  if (dates && dates.length >= 2) {
    result.checkInDate = dates[0].trim();
    result.checkOutDate = dates[1].trim();
    return result;
  }

  // 날짜 범위 패턴 처리
  const dateRangePattern = /(\d+월\s+\d+일)\s*\([월화수목금토일]\)\s*(?:~|   )\s*(\d+월\s+\d+일)/;
  const rangeMatch = text.match(dateRangePattern);

  if (rangeMatch) {
    const year = new Date().getFullYear() + "년";
    result.checkInDate = `${year} ${rangeMatch[1].trim()}`;
    result.checkOutDate = `${year} ${rangeMatch[2].trim()}`;
    return result;
  }

  // 타이틀에서 날짜 추출 시도
  const titleDateMatch = title.match(/(\d{4}년)?\s*(\d+월\s+\d+일)~(\d+일)/);

  if (titleDateMatch) {
    const year = titleDateMatch[1] || new Date().getFullYear() + "년";
    const month = titleDateMatch[2].split("월")[0] + "월";
    result.checkInDate = `${year} ${titleDateMatch[2]}`;
    result.checkOutDate = `${year} ${month} ${titleDateMatch[3]}`;
  }

  return result;
}

/**
 * 공통 숙소명 파싱 로직
 * @param {string} text - 파싱할 전체 텍스트
 * @returns {Object|null} - 파싱된 숙소 정보 객체
 */
function extractAccommodationInfo(text, isLineText = false) {
  if (!text) return null;

  // 다양한 숙소명 패턴들
  const patterns = [
    // [한정세일] 카이브No.X 패턴
    /\[한정세일\]\s+카이브(?:No\.|NO\.|no\.|\s)?\.?\s*(\d+)\s+([^|]+)/i,
    // 카이브No.X 패턴 (한정세일 없음)
    /카이브(?:No\.|NO\.|no\.|\s)?\.?\s*(\d+)\s+([^|]+)/i,
    // 카이브 X번 패턴
    /카이브\s*(\d+)(?:번)?\s+([^|]+)/i,
    // 그 외의 패턴 (번호만 있는 경우)
    /(?:No\.|NO\.|no\.|#)(\d+)\s+([^|]+)/i,
  ];

  let match = null;
  for (const pattern of patterns) {
    match = text.match(pattern);
    if (match) break;
  }

  if (!match) return null;

  // 기본 정보 추출
  const fullMatch = match[0];
  const number = match[1];
  const location = match[2].trim();

  // 전체 이름 추출 (파이프 구분자 포함)
  let fullName = fullMatch;

  if (!isLineText) {
    // 한 줄 텍스트가 아닐 경우, 더 넓은 범위 검색
    const startIndex = text.indexOf(fullMatch);
    if (startIndex !== -1) {
      let pipeIndex = text.indexOf("|", startIndex);
      if (pipeIndex !== -1) {
        let pipeCount = 0;
        let endIndex = pipeIndex;

        while (endIndex < text.length && pipeCount < 4) {
          if (text[endIndex] === "|") pipeCount++;
          endIndex++;

          // 줄바꿈이나 마침표, 큰따옴표를 만나면 중단
          if (
            endIndex < text.length &&
            (text[endIndex] === "\n" || text[endIndex] === "." || text[endIndex] === '"')
          )
            break;
        }

        fullName = text.substring(startIndex, endIndex).trim();
      }
    }
  }

  // 결과 객체 생성
  const result = {
    name: fullName,
    number,
    location,
    features: {},
  };

  // 모든 가능한 패턴에서 특징을 추출
  // 여러 텍스트 소스에서 추출
  const textsToCheck = [fullName, text];
  for (const textSource of textsToCheck) {
    // 특징 추출
    const features = extractFeatures(textSource);

    // 기존 features에 없는 속성만 추가
    for (const [key, value] of Object.entries(features)) {
      if (!result.features[key]) {
        result.features[key] = value;
      }
    }
  }

  return result;
}

/**
 * 숙소명에서 특징(오션뷰, 독채 등)을 추출
 * @param {string} text - 숙소명 텍스트
 * @returns {Object} - 추출된 특징 객체
 */
function extractFeatures(text) {
  const features = {};

  // 오션뷰
  if (/오션뷰|오션 뷰|ocean\s*view/i.test(text)) {
    features.oceanView = true;
  }

  // 독채
  if (/독채|단독|whole|entire/i.test(text)) {
    features.privateHouse = true;
  }

  // 평수 (다양한 패턴)
  const sizePatterns = [/(\d+)\s*평(?:대|형)?/, /(\d+)\s*pyeong/i, /(\d+)\s*㎡/];

  for (const pattern of sizePatterns) {
    const sizeMatch = text.match(pattern);
    if (sizeMatch) {
      features.size = parseInt(sizeMatch[1]);
      features.sizeText = sizeMatch[0];
      break;
    }
  }

  // 수용 인원 (다양한 패턴)
  const capacityPatterns = [
    /(\d+)~(\d+)인/,
    /(\d+)~(\d+)\s*persons/i,
    /(\d+)\s*~\s*(\d+)\s*guests/i,
    /최대\s*(\d+)인/,
  ];

  for (const pattern of capacityPatterns) {
    const capacityMatch = text.match(pattern);
    if (capacityMatch) {
      if (capacityMatch.length > 2) {
        features.minCapacity = parseInt(capacityMatch[1]);
        features.maxCapacity = parseInt(capacityMatch[2]);
        features.capacityText = `${features.minCapacity}~${features.maxCapacity}인`;
      } else if (capacityMatch.length > 1) {
        features.maxCapacity = parseInt(capacityMatch[1]);
        features.capacityText = `최대 ${features.maxCapacity}인`;
      }
      break;
    }
  }

  // 개별 바베큐
  if (/개별\s*바베큐|bbq|바비큐/i.test(text)) {
    features.privateBBQ = true;
  }

  // 최대 규모
  if (/최대\s*규모|largest|big/i.test(text)) {
    features.largestSize = true;
  }

  return features;
}

/**
 * 숙소명을 파싱합니다
 * @param {string} text - 파싱할 전체 텍스트
 * @returns {Object|null} 파싱된 숙소명 객체
 */
function parseAccommodationName(text) {
  if (!text) return null;

  // 기본 파싱 로직 수행
  const result = extractAccommodationInfo(text);

  // 파싱 실패 시 대체 방법 시도: 줄별 검색
  if (!result) {
    const lines = text.split("\n");

    // 첫 번째 검색: [한정세일] 또는 카이브가 포함된 줄
    for (const line of lines) {
      if (
        (line.includes("[한정세일]") || line.includes("카이브")) &&
        (line.includes("오션뷰") || line.includes("독채") || line.includes("평"))
      ) {
        const lineResult = extractAccommodationInfo(line, true);
        if (lineResult) {
          logger.info("PARSE_CONFIRMED_NAME", `줄 패턴으로 숙소명 발견: ${line}`);
          return lineResult;
        }
      }
    }

    // 두 번째 검색: NO.X 패턴이 있는 줄
    for (const line of lines) {
      if (/(NO\.|No\.|#)(\d+)/i.test(line)) {
        logger.info("PARSE_CONFIRMED_NAME", `번호 패턴으로 숙소명 발견: ${line}`);
        return {
          name: line.trim(),
          number: line.match(/(NO\.|No\.|#)(\d+)/i)[2],
          location: "",
          features: extractFeatures(line),
        };
      }
    }

    // 세 번째 검색: 제목에서 추출
    if (file && file.title) {
      const titleMatch = file.title.match(/카이브(?:No\.|NO\.|no\.|\s)?\.?\s*(\d+)/i);
      if (titleMatch) {
        logger.info("PARSE_CONFIRMED_NAME", `제목에서 숙소명 추출: ${file.title}`);
        return {
          name: file.title,
          number: titleMatch[1],
          location: "",
          features: extractFeatures(file.title),
        };
      }
    }
  }

  return result;
}

/**
 * 예약 상태를 결정합니다
 * @param {string} title - 메시지 제목
 * @returns {string} 예약 상태
 */
function determineReservationStatus(title) {
  if (title.includes("취소됨") || title.includes("취소되었습니다")) {
    return "예약취소";
  } else if (title.includes("대기 중") || title.includes("예약 요청")) {
    return "예약대기";
  } else if (title.includes("예약 확정") || title.includes("체크인할 예정입니다")) {
    return "예약확정";
  }
  return "알수없음";
}

/**
 * 취소된 예약의 정보를 파싱합니다
 * @param {string} text - 파싱할 전체 텍스트
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseCancelledReservation(text, parsedContent) {
  // 예약번호 파싱
  const reservationNumberMatch = text.match(/예약\(([A-Z0-9]+)\)/);
  if (reservationNumberMatch) {
    parsedContent.reservationNumber = reservationNumberMatch[1];
  }

  // 게스트 정보 파싱
  const guestMatch = text.match(/게스트\s+([^\s]+)\s+님이/);
  if (guestMatch) {
    parsedContent.guestName = guestMatch[1];
  }

  // 예약 인원 파싱
  const guestsMatch = text.match(/숙박\s+인원\s+(\d+)\s*명/);
  if (guestsMatch) {
    parsedContent.guestCount = guestsMatch[1];
  }

  // 호스트 수익 파싱
  const amountMatch = text.match(/변경\s+후\s+금액:\s*₩([\d,]+)/);
  if (amountMatch) {
    parsedContent.hostEarnings = amountMatch[1];
  }

  // URL 파싱
  const urlMatch = text.match(/https:\/\/www\.airbnb\.co\.kr\/hosting\/reservations\/[^\s]+/);
  if (urlMatch) {
    parsedContent.reservationDetailUrl = urlMatch[0];
  }

  // 체크인/아웃 날짜 파싱
  parseCancelledDates(text, parsedContent);
}

/**
 * 취소된 예약의 날짜 정보를 파싱합니다
 * @param {string} text - 파싱할 전체 텍스트
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseCancelledDates(text, parsedContent) {
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

    parsedContent.checkInDate = `${year} ${checkInDate}`;
    parsedContent.checkOutDate = `${year} ${checkOutDate}`;
    return;
  }

  // 전체 날짜 형식으로 된 경우 처리
  const fullDatePattern = /(\d{4}년\s+\d+월\s+\d+일)/g;
  const dates = text.match(fullDatePattern);
  if (dates && dates.length >= 2) {
    parsedContent.checkInDate = dates[0];
    parsedContent.checkOutDate = dates[1];
  }
}

/**
 * 일반 예약의 정보를 파싱합니다
 * @param {string} text - 파싱할 전체 텍스트
 * @param {string} title - 메시지 제목
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseRegularReservation(text, title, parsedContent) {
  // 게스트 정보 파싱
  parseGuestInfo(text, parsedContent);

  // 체크인/아웃 정보 파싱
  const checkInOutInfo = parseCheckInOut(text, title);
  Object.assign(parsedContent, checkInOutInfo);

  // 예약번호 파싱
  parseReservationNumber(text, parsedContent);

  // URL 파싱
  const urlMatch = text.match(/https:\/\/www\.airbnb\.co\.kr\/hosting\/reservations\/details\/\w+/);
  if (urlMatch) {
    parsedContent.reservationDetailUrl = urlMatch[0];
  }

  // 예약 인원 파싱
  const guestsMatch = text.match(/성인\s+(\d+)명/);
  if (guestsMatch) {
    parsedContent.guestCount = guestsMatch[1];
  }

  // 결제 정보 파싱
  parsePaymentInfo(text, parsedContent);
}

/**
 * 게스트 정보를 파싱합니다
 * @param {string} text - 파싱할 전체 텍스트
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseGuestInfo(text, parsedContent) {
  const guestPatterns = [
    /게스트\s+(.+)\s+님이.*예약.*취소했습니다/,
    /(.+)님에게\s+메시지를\s+보내\s+체크인/,
    /(.+)님의\s+예약\s+요청에\s+답하세요/,
    /(.+)\s+님이.*체크인할\s+예정입니다/,
  ];

  for (const pattern of guestPatterns) {
    const match = text.match(pattern);
    if (match) {
      parsedContent.guestName = match[1].trim();
      break;
    }
  }
}

/**
 * 예약번호를 파싱합니다
 * @param {string} text - 파싱할 전체 텍스트
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseReservationNumber(text, parsedContent) {
  const reservationNumberPatterns = [
    /예약\s+번호\s*\r?\n\s*(\w+)/,
    /예약\s*번호[:\s]+(\w+)/,
    /reservations\/details\/(\w+)/,
  ];

  for (const pattern of reservationNumberPatterns) {
    const match = text.match(pattern);
    if (match) {
      parsedContent.reservationNumber = match[1];
      break;
    }
  }
}

/**
 * 결제 정보를 파싱합니다
 * @param {string} text - 파싱할 전체 텍스트
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parsePaymentInfo(text, parsedContent) {
  const paymentMatches = {
    totalAmount: /총\s+금액\(KRW\)\s+₩([\d,]+)/,
    hostEarnings: /호스트\s+수익\s+₩([\d,]+)/,
    serviceFee: /호스트\s+서비스\s+수수료\([^)]+\)\s+-₩([\d,]+)/,
  };

  for (const [field, pattern] of Object.entries(paymentMatches)) {
    const match = text.match(pattern);
    if (match) {
      parsedContent[field] = match[1];
    }
  }
}

/**
 * 메시지 내용을 파싱합니다
 * @param {Object} file - Slack 파일 객체
 * @param {string} title - 메시지 제목
 * @returns {Object} 파싱된 에어비앤비 데이터
 */
function parseMessageContent(file, title) {
  const text = file.plain_text;
  let parsedContent = {
    platform: "에어비앤비",
    reservationStatus: determineReservationStatus(title), // 예약상태
    accommodationName: "", // 숙소명
    checkInDate: "", // 체크인
    checkOutDate: "", // 체크아웃
    reservationNumber: "", // 예약번호
    guestName: "", // 게스트
    reservationDetailUrl: "", // 예약상세URL
    message: text.substring(0, 200) + "...", // 메시지 일부만 저장
    guestCount: "", // 예약인원
    totalAmount: "", // 총결제금액
    hostEarnings: "", // 호스트수익
    serviceFee: "", // 서비스수수료
    checkInTime: "", // 체크인시간
    checkOutTime: "", // 체크아웃시간
  };

  // 객실명 파싱
  parsedContent.accommodationName = parseAccommodationName(text);

  // 예약 상태에 따른 파싱 로직 선택
  if (parsedContent.reservationStatus === "예약취소") {
    parseCancelledReservation(text, parsedContent);
  } else {
    parseRegularReservation(text, title, parsedContent);
  }

  // 체크인/아웃 시간 기본값 설정
  if (!parsedContent.checkInTime) parsedContent.checkInTime = "오후 4:00";
  if (!parsedContent.checkOutTime) parsedContent.checkOutTime = "오전 11:00";

  // 숙소명이 여전히 없는 경우 제목에서 추출 시도
  if (!parsedContent.accommodationName && title) {
    // 제목에서 카이브No.X 패턴 찾기
    const titleMatch = title.match(/카이브(?:No\.|NO\.|no\.|\s)?\.?\s*(\d+)/i);
    if (titleMatch) {
      logger.info("PARSING", `제목에서 숙소명 추출 시도: ${title}`);
      parsedContent.accommodationName = {
        name: title,
        number: titleMatch[1],
        location: "",
        features: extractFeatures(title),
      };
    }
  }

  return parsedContent;
}

module.exports = { parseAirbnbMessage };
