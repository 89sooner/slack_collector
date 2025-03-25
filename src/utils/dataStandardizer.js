/**
 * 플랫폼별 데이터를 표준화하는 유틸리티
 */
const {
  formatGuestName,
  formatRoomName,
  formatDate,
  formatTsKoreaTime,
  extractNumber,
  parseDate,
} = require("./formatHandler");
const { createLogger } = require("./logger");

const logger = createLogger("DATA_STANDARDIZER");

/**
 * 숫자 문자열을 부동소수점으로 변환
 * @param {string|number} value - 변환할 값
 * @returns {number|null} - 변환된 숫자 또는 null
 */
function convertToNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = extractNumber(value);
  return isNaN(num) ? null : num;
}

/**
 * 날짜 문자열을 데이터베이스 타임스탬프 형식으로 변환
 * @param {string} dateStr - 날짜 문자열
 * @returns {string|null} - ISO 형식 날짜 또는 null
 */
function formatDateForDB(dateStr) {
  if (!dateStr) return null;
  try {
    const date = parseDate(dateStr);
    return date ? date.toISOString() : null;
  } catch (error) {
    return null;
  }
}

/**
 * 플랫폼별 데이터를 표준화된 형식으로 변환합니다
 * @param {Object} parsedMessage - 파싱된 메시지 객체
 * @param {Object} message - 원본 Slack 메시지
 * @returns {Object} 표준화된 데이터 객체
 */
function standardizeData(parsedMessage, message) {
  try {
    // 플랫폼별로 사용되는 특수 필드 선택
    const platformSpecificFields = {};

    if (parsedMessage.platform === "야놀자") {
      platformSpecificFields.sender = parsedMessage.발신자 || "";
      platformSpecificFields.sender_number = parsedMessage.발신번호 || "";
      platformSpecificFields.receiver = parsedMessage.수신자 || "";
      platformSpecificFields.receiver_number = parsedMessage.수신번호 || "";
      platformSpecificFields.received_date = formatDateForDB(parsedMessage.수신날짜);
    }

    // 표준화된 데이터 객체 생성
    return {
      platform: parsedMessage.platform,
      reservation_status: parsedMessage.예약상태,
      accommodation_name:
        parsedMessage.숙소명 || parsedMessage.펜션명 || parsedMessage.제휴점명 || "",
      reservation_number: parsedMessage.예약번호 || "",
      guest_name: parsedMessage.게스트 || parsedMessage.예약자 || parsedMessage.고객명 || "",
      final_guest_name: formatGuestName(
        parsedMessage.platform,
        parsedMessage.게스트 || parsedMessage.예약자 || parsedMessage.고객명 || ""
      ),
      guest_phone: parsedMessage.연락처 || parsedMessage.휴대전화번호 || "",
      room_name: parsedMessage.객실명 || "",
      final_room_name: formatRoomName(
        parsedMessage.platform,
        parsedMessage.객실명,
        parsedMessage.숙소명
      ),
      check_in_date: parsedMessage.체크인 || parsedMessage.입실일 || "",
      check_out_date: parsedMessage.체크아웃 || parsedMessage.퇴실일 || "",
      final_check_in_date: formatDate(
        parsedMessage.platform,
        parsedMessage.체크인 || parsedMessage.입실일,
        parsedMessage.예약상태
      ),
      final_check_out_date: formatDate(
        parsedMessage.platform,
        parsedMessage.체크아웃 || parsedMessage.퇴실일,
        parsedMessage.예약상태
      ),
      guests: parseInt(parsedMessage.예약인원 || parsedMessage.인원 || 0, 10) || null,
      total_price: convertToNumber(
        parsedMessage.총결제금액 ||
          parsedMessage.총판매가 ||
          parsedMessage.결제금액 ||
          parsedMessage.판매가격
      ),
      discount: convertToNumber(parsedMessage.할인),
      coupon: convertToNumber(parsedMessage.쿠폰),
      point: convertToNumber(parsedMessage.포인트),
      final_price: convertToNumber(parsedMessage.최종매출가),
      host_earnings: convertToNumber(parsedMessage.호스트수익),
      service_fee: convertToNumber(parsedMessage.서비스수수료),
      tax: convertToNumber(parsedMessage.숙박세),
      request: parsedMessage.요청사항 || parsedMessage.전달사항 || parsedMessage.메시지 || "",
      pickup_status: parsedMessage.픽업여부 || "",
      remaining_rooms: parsedMessage.잔여객실 || "",
      reservation_details_url: parsedMessage.예약상세URL || "",
      message: parsedMessage.메시지 || "",
      check_in_time: parsedMessage.체크인시간 || "",
      check_out_time: parsedMessage.체크아웃시간 || "",
      payment_date: parsedMessage.결제일 || "",
      message_sent: false, // 기본값 설정
      ts_unixtime: parseFloat(message.ts) || null,
      ts_korea_time: formatTsKoreaTime(
        new Date(message.ts * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
      ),
      ...platformSpecificFields,
    };
  } catch (error) {
    logger.error("STANDARDIZE", "데이터 표준화 중 오류 발생:", error);
    throw error;
  }
}

module.exports = { standardizeData, convertToNumber, formatDateForDB };
