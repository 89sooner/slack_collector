/**
 * 데이터 유효성 검증 유틸리티
 */
const { createLogger } = require("../logging/logger");

const logger = createLogger("DATA_VALIDATOR");

/**
 * 예약 데이터의 필수 필드 유효성을 검증합니다
 * @param {Object} data - 검증할 예약 데이터
 * @returns {boolean} 유효성 검증 결과
 */
function validateReservationData(data) {
  const requiredFields = [
    "platform",
    "reservation_status",
    "reservation_number",
    "final_guest_name",
  ];

  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    logger.warning(
      "VALIDATION",
      `예약 데이터에 필수 필드가 누락되었습니다: ${missingFields.join(", ")}`
    );
    return false;
  }

  return true;
}

/**
 * 문자열이 유효한 날짜 형식인지 검증합니다
 * @param {string} dateStr - 검증할 날짜 문자열
 * @returns {boolean} 유효성 검증 결과
 */
function isValidDate(dateStr) {
  if (!dateStr) return false;

  // ISO 날짜 형식(YYYY-MM-DD) 검증
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dateStr)) return false;

  // 날짜 유효성 검증
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * 연락처 형식이 유효한지 검증합니다
 * @param {string} phone - 검증할 연락처
 * @returns {boolean} 유효성 검증 결과
 */
function isValidPhoneNumber(phone) {
  if (!phone) return true; // 선택적 필드

  // 전화번호 형식 검증 (국내 번호 기준)
  const phonePattern = /^(\d{2,3})-?(\d{3,4})-?(\d{4})$/;
  return phonePattern.test(phone);
}

module.exports = {
  validateReservationData,
  isValidDate,
  isValidPhoneNumber,
};
