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
    "예약상세URL",
    "메시지",
    "예약인원",
    "총결제금액",
    "호스트수익",
    "서비스수수료",
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

  return isValid;
}

async function parseAirbnbMessage(message) {
  if (message.files && message.files.length > 0) {
    const file = message.files[0];
    try {
      const parsedContent = parseMessageContent(file, file.title);
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

function parseMessageContent(file, title) {
  const text = file.plain_text;
  let parsedContent = {
    플랫폼: "에어비앤비",
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

  // 제목에 따른 예약 상태 분류
  if (title.includes("취소됨")) {
    parsedContent.예약상태 = "예약취소";
  } else if (title.includes("대기 중")) {
    parsedContent.예약상태 = "예약대기";
  } else if (title.includes("예약 확정")) {
    parsedContent.예약상태 = "예약확정";
  } else if (title.includes("예약 알림")) {
    parsedContent.예약상태 = "예약알림";
  } else {
    parsedContent.예약상태 = "알수없음";
  }

  // 게스트 이름 파싱
  if (parsedContent.예약상태 === "예약확정") {
    const guestNameMatch = text.match(
      /(.+)님에게 메시지를 보내 체크인 세부사항을 확인하거나 인사말을 전하세요./
    );
    if (guestNameMatch) {
      parsedContent.게스트 = guestNameMatch[1].trim();
    }
  } else {
    const guestNameMatch = text.match(/(.+)님의 예약 요청에 답하세요./);
    if (guestNameMatch) {
      parsedContent.게스트 = guestNameMatch[1].trim();
    }
  }

  // 숙소명 파싱
  const accommodationNameMatch = text.match(/\r\n\r\n(.+)\r\n\r\n(집|공간) 전체/);
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
  const reservationNumberMatch = text.match(/예약 번호\r\n(\w+)/);
  if (reservationNumberMatch) {
    parsedContent.예약번호 = reservationNumberMatch[1];
  }

  // 예약 상세 URL 파싱
  const reservationUrlMatch = text.match(
    /https:\/\/www\.airbnb\.co\.kr\/hosting\/reservations\/details\/(\w+)/
  );
  if (reservationUrlMatch) {
    parsedContent.예약상세URL = reservationUrlMatch[0];
  }

  // 게스트 메시지 파싱
  const messageMatch = text.match(/\r\n\r\n(.+)\r\n\r\n/);
  if (messageMatch) {
    parsedContent.메시지 = messageMatch[1].trim();
  }

  // 예약 인원 파싱
  const guestsMatch = text.match(/성인 (\d+)명/);
  if (guestsMatch) {
    parsedContent.예약인원 = guestsMatch[1];
  }

  // 결제 정보 파싱
  const paymentInfoMatch = text.match(/총 금액\(KRW\)\s+₩([\d,]+)/);
  if (paymentInfoMatch) {
    parsedContent.총결제금액 = paymentInfoMatch[1];
  }

  const hostEarningMatch = text.match(/호스트 수익\s+₩([\d,]+)/);
  if (hostEarningMatch) {
    parsedContent.호스트수익 = hostEarningMatch[1];
  }

  const hostFeeMatch = text.match(/호스트 서비스 수수료\([\d.]+%\)\s+-₩([\d,]+)/);
  if (hostFeeMatch) {
    parsedContent.서비스수수료 = hostFeeMatch[1];
  }

  return parsedContent;
}

module.exports = { parseAirbnbMessage };
