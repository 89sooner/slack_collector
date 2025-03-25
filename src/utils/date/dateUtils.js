/**
 * 날짜 처리를 위한 유틸리티 함수
 */
const { createLogger } = require("../logging/logger");

const logger = createLogger("DATE_UTILS");

/**
 * 현재 날짜를 YYYY-MM-DD 형식의 문자열로 반환합니다
 * @returns {string} 형식화된 현재 날짜
 */
function getTodayFormatted() {
  const today = new Date();
  return formatDate(today);
}

/**
 * 날짜 객체를 YYYY-MM-DD 형식의 문자열로 변환합니다
 * @param {Date} date - 변환할 날짜 객체
 * @returns {string} 형식화된 날짜 문자열
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 날짜에 일수를 더합니다
 * @param {Date|string} date - 기준 날짜
 * @param {number} days - 더할 일수
 * @returns {Date} 계산된 새 날짜
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * 두 날짜 사이의 일수를 계산합니다
 * @param {Date|string} startDate - 시작 날짜
 * @param {Date|string} endDate - 종료 날짜
 * @returns {number} 두 날짜 사이의 일수
 */
function getDaysDifference(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * 한국 시간대(KST)로 날짜와 시간을 포맷팅합니다
 * @param {Date|string} date - 변환할 날짜
 * @returns {string} 한국 시간대로 형식화된 날짜 문자열
 */
function formatKoreanDateTime(date) {
  try {
    const options = {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };

    return new Date(date)
      .toLocaleString("ko-KR", options)
      .replace(/\. /g, "-")
      .replace(/\./g, "")
      .replace(",", "");
  } catch (error) {
    logger.error("FORMAT", "날짜 형식 변환 중 오류:", error);
    return String(date);
  }
}

module.exports = {
  getTodayFormatted,
  formatDate,
  addDays,
  getDaysDifference,
  formatKoreanDateTime,
};
