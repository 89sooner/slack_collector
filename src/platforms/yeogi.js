/**
 * 여기어때 메시지 파싱 모듈
 */
const cheerio = require("cheerio");
const { createLogger } = require("../utils/logging/logger");
const { downloadAndReadHtml } = require("../utils/slack/fileDownloader");

const logger = createLogger("YEOGI");

/**
 * 파싱된 콘텐츠의 유효성을 검사하고 로깅합니다
 * @param {Object} parsedContent - 파싱된 여기어때 데이터
 * @param {string} title - 메시지 제목
 * @returns {boolean} 유효성 검사 결과
 */
function validateAndLogParsedContent(parsedContent, title) {
  const commonRequiredFields = [
    "partnerName", // 제휴점명
    "reservationNumber", // 예약번호
    "paymentDate", // 결제일
    "checkInDate", // 체크인
    "checkOutDate", // 체크아웃
    "stayDuration", // 투숙기간
    "customerName", // 고객명
    "phoneNumber", // 연락처
  ];

  const statusSpecificFields = {
    예약확정: ["roomName", "totalSellingPrice", "totalDepositAmount"], // 객실명, 총판매가, 총입금가
    예약대기: ["roomName"], // 객실명
    예약취소: [],
  };

  let requiredFields = [...commonRequiredFields];
  if (statusSpecificFields[parsedContent.reservationStatus]) {
    requiredFields = [...requiredFields, ...statusSpecificFields[parsedContent.reservationStatus]];
  }

  let isValid = true;

  logger.warning("PARSING", `[여기어때] Title: ${title}`);
  requiredFields.forEach((field) => {
    if (!parsedContent[field]) {
      logger.warning("PARSING", `Warning: ${field} is empty or missing`);
      isValid = false;
    }
  });

  // 예약대기 상태일 때 잔여객실 정보가 없어도 됨
  if (parsedContent.reservationStatus !== "예약대기" && !parsedContent.remainingRooms) {
    logger.warning("PARSING", `Warning: remainingRooms is empty or missing`);
    isValid = false;
  }

  return isValid;
}

/**
 * 여기어때 메시지를 파싱합니다
 * @param {Object} message - Slack 메시지 객체
 * @returns {Promise<Object|null>} 파싱된 여기어때 데이터 또는 null
 */
async function parseYeogiMessage(message) {
  if (!message.files || message.files.length === 0) {
    logger.info("PARSING", "파일이 없는 메시지입니다");
    return null;
  }

  const file = message.files[0];
  if (!file.url_private_download) {
    logger.info("PARSING", "다운로드 URL이 없어 텍스트 파싱으로 대체합니다");
    return parseMessageContent(file);
  }

  try {
    const htmlContent = await downloadAndReadHtml(file.url_private_download, file.id);
    const parsedContent = parseHtmlContent(htmlContent, file.title);
    validateAndLogParsedContent(parsedContent, file.title);
    return parsedContent;
  } catch (error) {
    logger.error("PARSING", "HTML 파싱 실패, 텍스트 파싱으로 대체:", error);
    return parseMessageContent(file);
  }
}

/**
 * HTML 내용을 파싱하여 구조화된 데이터로 변환합니다
 * @param {string} html - HTML 문자열
 * @param {string} title - 메시지 제목
 * @returns {Object} 파싱된 여기어때 데이터
 */
function parseHtmlContent(html, title) {
  const $ = cheerio.load(html);
  let parsedContent = {
    platform: "여기어때",
    reservationStatus: "", // 예약상태
    partnerName: "", // 제휴점명
    reservationNumber: "", // 예약번호
    paymentDate: "", // 결제일
    checkInDate: "", // 체크인
    checkOutDate: "", // 체크아웃
    stayDuration: "", // 투숙기간
    customerName: "", // 고객명
    phoneNumber: "", // 연락처
    roomName: "", // 객실명
    remainingRooms: "", // 잔여객실
    totalSellingPrice: "", // 총판매가
    totalDepositAmount: "", // 총입금가
    discount: "", // 할인
    coupon: "", // 쿠폰
    point: "", // 포인트
    finalSalesPrice: "", // 최종매출가
    deliveryNote: "", // 전달사항
  };

  // 제목에서 예약 상태 파싱
  if (title.includes("예약 취소")) {
    parsedContent.reservationStatus = "예약취소";
  } else if (title.includes("예약대기 확인")) {
    parsedContent.reservationStatus = "예약대기";
  } else if (title.includes("예약대기 취소")) {
    parsedContent.reservationStatus = "예약대기취소";
  } else if (title.includes("예약 확정")) {
    parsedContent.reservationStatus = "예약확정";
  } else {
    parsedContent.reservationStatus = "알수없음";
  }

  // 제목에서 예약번호 파싱
  const reservationNumberMatch = title.match(/\d{14}YE1/);
  if (reservationNumberMatch) {
    parsedContent.reservationNumber = reservationNumberMatch[0];
  }

  // HTML에서 정보 추출
  parseHtmlTables($, parsedContent);
  parseTransmissionSection($, parsedContent);

  return parsedContent;
}

/**
 * HTML 테이블에서 정보를 추출합니다
 * @param {Object} $ - Cheerio 객체
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseHtmlTables($, parsedContent) {
  // 모든 테이블을 순회하며 정보 추출
  $("table").each((index, table) => {
    const tableHtml = $(table).html();

    // 제휴점명, 예약번호, 결제일 파싱
    if (
      tableHtml.includes("제휴점명") ||
      tableHtml.includes("예약번호") ||
      tableHtml.includes("결제일")
    ) {
      parsePartnerInfo($, table, parsedContent);
    }

    // 예약 내역 테이블 파싱
    if (tableHtml.includes("체크인") && tableHtml.includes("체크아웃")) {
      parseReservationDetails($, table, parsedContent);
    }

    // 객실 정보 파싱
    if (tableHtml.includes("객실명")) {
      parseRoomInfo($, table, parsedContent);
    }

    // 결제 내역 파싱
    if (tableHtml.includes("총 판매가") && tableHtml.includes("최종 매출가")) {
      parsePaymentInfo($, table, parsedContent);
    }
  });

  // 객실명을 찾지 못한 경우 ul/li에서 추가 검색
  if (!parsedContent.roomName) {
    $("ul li").each((index, element) => {
      const text = $(element).text().trim();
      if (text.includes("객실명:")) {
        const match = text.match(/객실명:\s*([^]*?)(?=\s*$|\s*$)/);
        if (match && match[1]) {
          parsedContent.roomName = match[1].trim();
        }
      }
    });
  }
}

/**
 * 파트너 정보를 파싱합니다
 * @param {Object} $ - Cheerio 객체
 * @param {Object} table - 테이블 요소
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parsePartnerInfo($, table, parsedContent) {
  $(table)
    .find("tr")
    .each((i, row) => {
      const text = $(row).text().trim();
      if (text.includes("제휴점명")) {
        parsedContent.partnerName = text.split(":")[1].trim();
      } else if (text.includes("예약번호") && !parsedContent.reservationNumber) {
        // 이미 제목에서 파싱한 예약번호가 없을 경우에만 업데이트
        parsedContent.reservationNumber = text.split(":")[1].trim();
      } else if (text.includes("결제일")) {
        parsedContent.paymentDate = text.split("결제일 :")[1].trim();
      }
    });
}

/**
 * 예약 상세 정보를 파싱합니다
 * @param {Object} $ - Cheerio 객체
 * @param {Object} table - 테이블 요소
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseReservationDetails($, table, parsedContent) {
  const rows = $(table).find("tr");
  if (rows.length >= 2) {
    const columns = rows.eq(1).find("td");
    parsedContent.checkInDate = columns.eq(0).text().replace(/\s+/g, " ").trim();
    parsedContent.checkOutDate = columns.eq(1).text().replace(/\s+/g, " ").trim();
    parsedContent.stayDuration = columns.eq(2).text().trim();
    parsedContent.customerName = columns.eq(3).text().trim();
    parsedContent.phoneNumber = columns.eq(4).text().trim();
  }
}

/**
 * 객실 정보를 파싱합니다
 * @param {Object} $ - Cheerio 객체
 * @param {Object} table - 테이블 요소
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseRoomInfo($, table, parsedContent) {
  const roomInfoText = $(table).find("tr").eq(0).find("td").eq(1).text().trim();
  const roomInfoParts = roomInfoText.split("잔여 객실");
  parsedContent.roomName = roomInfoParts[0].trim();
  if (roomInfoParts.length > 1) {
    parsedContent.remainingRooms = roomInfoParts[1].trim();
  }
}

/**
 * 결제 정보를 파싱합니다
 * @param {Object} $ - Cheerio 객체
 * @param {Object} table - 테이블 요소
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parsePaymentInfo($, table, parsedContent) {
  const paymentRows = $(table).find("tr");
  if (paymentRows.length >= 2) {
    const columns = paymentRows.eq(1).find("td");
    parsedContent.totalSellingPrice = columns.eq(0).text().trim();
    parsedContent.totalDepositAmount = columns.eq(1).text().trim();
    parsedContent.discount = columns.eq(2).text().trim();
    parsedContent.coupon = columns.eq(3).text().trim();
    parsedContent.point = columns.eq(4).text().trim();
    parsedContent.finalSalesPrice = columns.eq(5).text().trim();
  }
}

/**
 * 전달사항 섹션을 파싱합니다
 * @param {Object} $ - Cheerio 객체
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseTransmissionSection($, parsedContent) {
  const transmissionSection = $('td:contains("전달사항")').next();
  parsedContent.deliveryNote = transmissionSection
    .find("li")
    .map((index, element) => $(element).text().trim())
    .get()
    .join(" ");
}

/**
 * 텍스트 파일의 내용을 파싱합니다
 * @param {Object} file - Slack 파일 객체
 * @returns {Object} 파싱된 여기어때 데이터
 */
function parseMessageContent(file) {
  let parsedContent = {
    platform: "여기어때",
    reservationStatus: "", // 예약상태
    partnerName: "", // 제휴점명
    reservationNumber: "", // 예약번호
    paymentDate: "", // 결제일
    checkInDate: "", // 체크인
    checkOutDate: "", // 체크아웃
    stayDuration: "", // 투숙기간
    customerName: "", // 고객명
    phoneNumber: "", // 연락처
    roomName: "", // 객실명
    totalSellingPrice: "", // 총판매가
    totalDepositAmount: "", // 총입금가
    discount: "", // 할인
    coupon: "", // 쿠폰
    point: "", // 포인트
    finalSalesPrice: "", // 최종매출가
    deliveryNote: "", // 전달사항
  };

  const text = file.plain_text;
  const lines = text.split("\n");

  // 기본 정보 파싱
  parseBasicInfo(lines, parsedContent);

  // 전달사항 추출 (여러 줄일 수 있음)
  parseTransmissionInfo(text, parsedContent);

  // 추가 메타데이터
  parsedContent.emailTitle = file.title || "";
  parsedContent.attachmentName = file.name || "";
  parsedContent.createdAt = new Date(file.created * 1000).toISOString();

  return parsedContent;
}

/**
 * 기본 정보를 파싱합니다
 * @param {Array} lines - 텍스트 파일의 줄 배열
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseBasicInfo(lines, parsedContent) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("제휴점명 :")) {
      parsedContent.partnerName = line.split(":")[1].trim();
    } else if (line.startsWith("예약번호 :")) {
      parsedContent.reservationNumber = line.split(":")[1].trim();
    } else if (line.startsWith("결제일 :")) {
      parsedContent.paymentDate = line.split(":")[1].trim();
    } else if (line.startsWith("체크인")) {
      parsedContent.checkInDate = lines[i + 1].trim();
    } else if (line.startsWith("체크아웃")) {
      parsedContent.checkOutDate = lines[i + 1].trim();
    } else if (line.startsWith("투숙기간")) {
      parsedContent.stayDuration = lines[i + 1].trim();
    } else if (line.startsWith("고객명")) {
      parsedContent.customerName = lines[i + 1].trim();
    } else if (line.startsWith("연락처")) {
      parsedContent.phoneNumber = lines[i + 1].trim();
    } else if (line.startsWith("객실명")) {
      parsedContent.roomName = lines[i + 1].trim();
    } else if (line.includes("총 판매가")) {
      parsedContent.totalSellingPrice = line.split("총 판매가")[1].trim();
    } else if (line.includes("총 입금가")) {
      parsedContent.totalDepositAmount = line.split("총 입금가")[1].trim();
    } else if (line.includes("할인")) {
      parsedContent.discount = line.split("할인")[1].trim();
    } else if (line.includes("쿠폰")) {
      parsedContent.coupon = line.split("쿠폰")[1].trim();
    } else if (line.includes("포인트")) {
      parsedContent.point = line.split("포인트")[1].trim();
    } else if (line.includes("최종 매출가")) {
      parsedContent.finalSalesPrice = line.split("최종 매출가")[1].trim();
    }
  }
}

/**
 * 전달사항 정보를 파싱합니다
 * @param {string} text - 전체 텍스트
 * @param {Object} parsedContent - 파싱 결과 객체
 */
function parseTransmissionInfo(text, parsedContent) {
  const deliveryNoteIndex = text.indexOf("전달사항");
  if (deliveryNoteIndex !== -1) {
    const deliveryNoteEnd = text.indexOf("파트너센터 URL:", deliveryNoteIndex);
    if (deliveryNoteEnd !== -1) {
      parsedContent.deliveryNote = text
        .slice(deliveryNoteIndex + "전달사항".length, deliveryNoteEnd)
        .trim();
    }
  }
}

module.exports = { parseYeogiMessage };
