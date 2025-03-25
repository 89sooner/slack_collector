/**
 * 네이버 예약 메시지 파싱 모듈
 */
const cheerio = require("cheerio");
const { createLogger } = require("../utils/logger");
const { downloadAndReadHtml } = require("../utils/fileDownloader");

const logger = createLogger("NAVER");

/**
 * 파싱된 콘텐츠의 유효성을 검사하고 로깅합니다
 * @param {Object} parsedContent - 파싱된 네이버 예약 데이터
 * @param {string} title - 메시지 제목
 * @returns {boolean} 유효성 검사 결과
 */
function validateAndLogParsedContent(parsedContent, title) {
  const requiredFields = [
    "platform",
    "예약상태",
    "예약번호",
    "예약자",
    "객실명",
    "체크인",
    "체크아웃",
    "결제금액",
  ];

  let isValid = true;

  logger.warning("PARSING", `[네이버] Title: ${title}`);
  requiredFields.forEach((field) => {
    if (!parsedContent[field]) {
      logger.warning("PARSING", `Warning: ${field} is empty or missing`);
      isValid = false;
    }
  });

  return isValid;
}

/**
 * HTML 내용을 파싱하여 구조화된 데이터로 변환합니다
 * @param {string} html - HTML 문자열
 * @param {string} title - 메시지 제목
 * @returns {Object} 파싱된 네이버 예약 데이터
 */
function parseHtmlContent(html, title) {
  const $ = cheerio.load(html);
  let parsedContent = {
    platform: "네이버",
    예약상태: "",
    예약번호: "",
    예약자: "",
    연락처: "",
    객실명: "",
    체크인: "",
    체크아웃: "",
    인원: "",
    결제금액: "",
    요청사항: "",
  };

  // 제목에서 예약 상태 파싱
  if (title.includes("예약을 취소")) {
    parsedContent.예약상태 = "예약취소";
  } else if (title.includes("새로운 예약이 접수")) {
    parsedContent.예약상태 = "예약대기";
  } else if (
    title.includes("새로운 예약이 확정") ||
    title.includes("입금이 완료되어 예약이 확정")
  ) {
    parsedContent.예약상태 = "예약확정";
  } else {
    parsedContent.예약상태 = "알수없음";
  }

  // 예약자 정보 추출
  $('td[style*="color:#696969"]').each((index, element) => {
    const text = $(element).text().trim();

    switch (text) {
      case "예약자명":
        parsedContent.예약자 = $(element).next().text().trim().replace("님", "");
        break;
      case "예약번호":
        parsedContent.예약번호 = $(element).next().text().trim().split(" ")[0];
        break;
      case "예약상품":
        parsedContent.객실명 = $(element).next().text().trim();
        break;
      case "이용일시":
        const 이용일시 = $(element).next().text().trim();
        const match = 이용일시.match(
          /(\d{4}\.\d{2}\.\d{2})\.\(.+?\)~(\d{4}\.\d{2}\.\d{2})\.\(.+?\)/
        );
        if (match) {
          parsedContent.체크인 = match[1];
          parsedContent.체크아웃 = match[2];
        }
        break;
      case "결제금액":
        const 결제금액Text = $(element).next().text().trim();
        const priceMatch = 결제금액Text.match(/(\d{1,3}(,\d{3})*원)/);
        if (priceMatch) {
          parsedContent.결제금액 = priceMatch[1];
        }
        break;
      case "요청사항":
        parsedContent.요청사항 = $(element).next().text().trim();
        break;
    }
  });

  return parsedContent;
}

/**
 * 네이버 예약 메시지를 파싱합니다
 * @param {Object} message - Slack 메시지 객체
 * @returns {Promise<Object|null>} 파싱된 네이버 예약 데이터 또는 null
 */
async function parseNaverBookingMessage(message) {
  if (message.files && message.files.length > 0) {
    const file = message.files[0];
    if (file.url_private_download) {
      try {
        const htmlContent = await downloadAndReadHtml(file.url_private_download, file.id);
        const parsedContent = parseHtmlContent(htmlContent, file.title);
        validateAndLogParsedContent(parsedContent, file.title);
        return parsedContent;
      } catch (error) {
        logger.error("PARSING", "네이버 예약 메시지 파싱 중 오류:", error);
        return null;
      }
    }
  }
  logger.info("PARSING", "파싱할 파일 없음");
  return null;
}

module.exports = { parseNaverBookingMessage };
