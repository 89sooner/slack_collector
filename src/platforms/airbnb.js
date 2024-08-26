const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const stream = require("stream");
const { promisify } = require("util");

const finished = promisify(stream.finished);

function validateAndLogParsedContent(parsedContent) {
  const requiredFields = [
    "예약상태",
    "숙소명",
    "체크인",
    "체크아웃",
    "예약번호",
    "게스트",
    "예약날짜",
    "예약상세URL",
    "예약인원",
    "예상수입",
    "호스트",
    "체크인시간",
    "체크아웃시간",
  ];

  let isValid = true;

  requiredFields.forEach((field) => {
    if (!parsedContent[field]) {
      console.warn(`Warning: ${field} is empty or missing`);
      isValid = false;
    }
  });

  console.log("Parsed content:", JSON.stringify(parsedContent, null, 2));
  console.log("Is valid:", isValid);

  return isValid;
}

async function parseAirbnbMessage(message) {
  if (message.files && message.files.length > 0) {
    const file = message.files[0];
    try {
      const parsedContent = parseMessageContent(file);
      validateAndLogParsedContent(parsedContent);

      console.log("===============================");
      return parsedContent;
    } catch (error) {
      console.error("Falling back to plain text parsing:", error);
      return null;
    }
  }
  console.log("No files found in the message");
  return null;
}

async function downloadAndReadHtml(url, fileId) {
  const downloadPath = path.join(__dirname, "..", "..", "downloads");
  const filePath = path.join(downloadPath, `${fileId}.html`);

  await fsPromises.mkdir(downloadPath, { recursive: true });

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

  const htmlContent = await fsPromises.readFile(filePath, "utf8");

  await fsPromises.unlink(filePath);

  return htmlContent;
}

function parseHtmlContent(html, title) {
  const $ = cheerio.load(html);
  let parsedContent = {
    플랫폼: "에어비앤비",
    예약상태: "",
    숙소명: "",
    체크인: "",
    체크아웃: "",
    예약번호: "",
    게스트: "",
    예약날짜: "",
    예약상세URL: "",
    휴대전화번호: "",
    예약인원: "",
    결제금액: "",
    호스트: "",
    체크인시간: "",
    체크아웃시간: "",
  };

  // 게스트 이름 파싱
  parsedContent.게스트 = $(
    'td > table > tbody > tr > td > a[href^="https://www.airbnb.co.kr/rooms/"]'
  )
    .text()
    .trim();

  // 숙소명 파싱
  parsedContent.숙소명 = $(
    "td > table > tbody > tr > td > table > tbody > tr > td > div > h2"
  )
    .text()
    .trim();

  // 체크인, 체크아웃 날짜 파싱
  const checkInOutText = $(
    "td > table > tbody > tr > td > table > tbody > tr > td > table > tbody > tr > td"
  )
    .eq(0)
    .text()
    .trim();
  const [checkIn, checkOut] = checkInOutText
    .split("체크아웃")
    .map((text) => text.trim());
  parsedContent.체크인 = checkIn.replace("체크인", "").trim();
  parsedContent.체크아웃 = checkOut;

  // 예약번호 파싱
  parsedContent.예약번호 = $(
    "td > table > tbody > tr > td > table > tbody > tr > td > div > h1"
  )
    .text()
    .match(/\d{12}HMCH/)[0];

  // 예약 날짜 파싱
  const reservationDateText = $("td > table > tbody > tr > td")
    .eq(1)
    .text()
    .trim();
  parsedContent.예약날짜 = reservationDateText.match(
    /\d{4}년 \d{1,2}월 \d{1,2}일/
  )[0];

  // 예약 상세 URL 파싱
  parsedContent.예약상세URL = $(
    "td > table > tbody > tr > td > table > tbody > tr > td > table > tbody > tr > td > div > a"
  ).attr("href");

  // 인원 파싱
  parsedContent.예약인원 = $(
    "td > table > tbody > tr > td > table > tbody > tr > td > div > p"
  )
    .filter((i, el) => $(el).text().includes("인원"))
    .text()
    .match(/\d+/)[0];

  // 예상 수익 파싱
  parsedContent.결제금액 = $(
    "td > table > tbody > tr > td > table > tbody > tr > td > div > p > b"
  )
    .text()
    .trim();

  // 호스트 정보는 메일에서 제공되지 않음

  // 체크인, 체크아웃 시간 정보는 메일에서 제공되지 않음

  return parsedContent;
}

function parseMessageContent(file) {
  const text = file.plain_text;
  let parsedContent = {
    플랫폼: "에어비앤비",
    예약상태: "예약 대기 중",
    숙소명: "",
    체크인: "",
    체크아웃: "",
    예약번호: "",
    게스트: "",
    예약날짜: "",
    예약상세URL: "",
    메시지: "",
    예약인원: "",
    예상수입: "",
    호스트: "",
    체크인시간: "",
    체크아웃시간: "",
  };

  // 게스트 이름 파싱
  const guestNameMatch = text.match(/^(.+)님을 호스팅하여/);
  if (guestNameMatch) {
    parsedContent.게스트 = guestNameMatch[1].trim();
  }

  // 숙소명 파싱
  const accommodationNameMatch = text.match(/\r\n\r\n(.+)\r\n\r\n방/);
  if (accommodationNameMatch) {
    parsedContent.숙소명 = accommodationNameMatch[1].trim();
  }

  // 체크인, 체크아웃 날짜 및 시간 파싱
  const checkInOutMatch = text.match(
    /체크인\s+체크아웃\r\n\s+\r\n(\d+월 \d+일 \(.\))\s+(\d+월 \d+일 \(.\))\r\n\s+\r\n(오\S+ \d+:\d+)\s+(오\S+ \d+:\d+)/
  );
  if (checkInOutMatch) {
    parsedContent.체크인 = checkInOutMatch[1].trim();
    parsedContent.체크아웃 = checkInOutMatch[2].trim();
    parsedContent.체크인시간 = checkInOutMatch[3].trim();
    parsedContent.체크아웃시간 = checkInOutMatch[4].trim();
  }

  // 예약번호 파싱
  const reservationNumberMatch = text.match(/\/HME\w+\?/);
  if (reservationNumberMatch) {
    parsedContent.예약번호 = reservationNumberMatch[0].slice(1, -1);
  }

  // 예약 상세 URL 파싱
  const reservationUrlMatch = text.match(
    /https:\/\/www\.airbnb\.co\.kr\/hosting\/reservations\/details\/\w+/
  );
  if (reservationUrlMatch) {
    parsedContent.예약상세URL = reservationUrlMatch[0];
  }

  // 게스트 메시지 파싱
  const messageMatch = text.match(
    /\r\n\r\n(.+)\r\n\r\nhttps:\/\/www\.airbnb\.co\.kr\/rooms/
  );
  if (messageMatch) {
    parsedContent.메시지 = messageMatch[1].trim();
  }

  // 예약 인원 파싱
  const guestsMatch = text.match(/성인 (\d+)명/);
  if (guestsMatch) {
    parsedContent.예약인원 = guestsMatch[1];
  }

  // 예상 수입 파싱
  const expectedEarningMatch = text.match(
    /₩([\d,]+)의 수입을 올리실 수 있습니다/
  );
  if (expectedEarningMatch) {
    parsedContent.예상수입 = expectedEarningMatch[1];
  }

  // 호스트 정보는 메일에서 제공되지 않음

  return parsedContent;
}

module.exports = { parseAirbnbMessage };
