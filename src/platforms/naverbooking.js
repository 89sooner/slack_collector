// /src/platforms/naverbooking.js
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const stream = require("stream");
const { promisify } = require("util");
const { createLogger } = require("../utils/logger");
const logger = createLogger("NAVER");

const finished = promisify(stream.finished);

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
        logger.error("DOWNLOADING", "Error downloading or parsing HTML content:", error);
        return null;
      }
    }
  }
  logger.info("PARSING", "No files found in the message");
  return null;
}

async function downloadAndReadHtml(url, fileId) {
  const downloadPath = path.join(__dirname, "..", "..", "downloads");
  const filePath = path.join(downloadPath, `${fileId}.html`);

  // 다운로드 디렉토리 생성
  await fsPromises.mkdir(downloadPath, { recursive: true });

  // 파일 다운로드
  const response = await axios({
    method: "get",
    url: url,
    responseType: "stream",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
  });

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  await finished(writer);

  // 파일 읽기
  const htmlContent = await fsPromises.readFile(filePath, "utf8");

  // 파일 삭제 (선택사항)
  await fsPromises.unlink(filePath);

  return htmlContent;
}

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

  // 예약자 추출
  $('td[style*="color:#696969"]').each((index, element) => {
    const text = $(element).text().trim();
    if (text === "예약자명") {
      parsedContent.예약자 = $(element).next().text().trim().replace("님", "");
    }
  });

  // 예약번호 추출
  $('td[style*="color:#696969"]').each((index, element) => {
    const text = $(element).text().trim();
    if (text === "예약번호") {
      parsedContent.예약번호 = $(element).next().text().trim().split(" ")[0];
    }
  });

  // 객실명 추출
  $('td[style*="color:#696969"]').each((index, element) => {
    const text = $(element).text().trim();
    if (text === "예약상품") {
      parsedContent.객실명 = $(element).next().text().trim();
    }
  });

  // 체크인, 체크아웃 추출
  $('td[style*="color:#696969"]').each((index, element) => {
    const text = $(element).text().trim();
    if (text === "이용일시") {
      const 이용일시 = $(element).next().text().trim();
      const match = 이용일시.match(/(\d{4}\.\d{2}\.\d{2})\.\(.+?\)~(\d{4}\.\d{2}\.\d{2})\.\(.+?\)/);
      if (match) {
        parsedContent.체크인 = match[1];
        parsedContent.체크아웃 = match[2];
      }
    }
  });

  // 결제금액 추출
  $('td[style*="color:#696969"]').each((index, element) => {
    const text = $(element).text().trim();
    if (text === "결제금액") {
      const 결제금액Text = $(element).next().text().trim();
      const match = 결제금액Text.match(/(\d{1,3}(,\d{3})*원)/);
      if (match) {
        parsedContent.결제금액 = match[1];
      }
    }
  });

  // 요청사항 추출
  $('td[style*="color:#696969"]').each((index, element) => {
    const text = $(element).text().trim();
    if (text === "요청사항") {
      parsedContent.요청사항 = $(element).next().text().trim();
    }
  });

  return parsedContent;
}

module.exports = { parseNaverBookingMessage };
