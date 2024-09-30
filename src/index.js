const config = require("../config/config");
const { getChannelHistory } = require("./utils/slackClient");
const { getLastReadTs, saveLastReadTs } = require("./utils/fileHandler");
const { parseYanoljaMessage } = require("./platforms/yanolja");
const { parseNaverBookingMessage } = require("./platforms/naverbooking");
const { parseAirbnbMessage } = require("./platforms/airbnb");
const { parseYeogiMessage } = require("./platforms/yeogi");
const { Pool } = require("pg");
const cron = require("node-cron");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

function extractNumber(value) {
  if (value) {
    return parseFloat(value.replace(/[^0-9.-]+/g, ""));
  }
  return 0;
}

// 날짜 형식 변환 함수
function formatDate(platform, dateString) {
  if (platform === "에어비앤비") {
    const airbnbDateFormat = /(\d+)월 (\d+)일 \(.\)/;
    const match = dateString.match(airbnbDateFormat);
    if (match) {
      const year = new Date().getFullYear();
      const month = match[1].padStart(2, "0");
      const day = match[2].padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } else if (platform === "야놀자") {
    const yanoljaDateFormat = /(\d{4})-(\d{2})-(\d{2})\(.\)/;
    const match = dateString.match(yanoljaDateFormat);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  } else if (platform === "네이버") {
    const naverBookingDateFormat = /(\d{4})\.(\d{2})\.(\d{2})/;
    const match = dateString.match(naverBookingDateFormat);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  } else if (platform === "여기어때") {
    const yeogiDateFormat = /(\d{4})-(\d{2})-(\d{2}) \(.\)/;
    const match = dateString.match(yeogiDateFormat);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  return "";
}

// 객실명 형식 변환 함수
function formatRoomName(platform, roomName, accommodationName) {
  if (platform === "에어비앤비") {
    return accommodationName || "";
  } else if (platform === "야놀자") {
    const yanoljaRoomNameFormat = /(.+) \(입실 \d+시, \d+평형\)/;
    const match = roomName.match(yanoljaRoomNameFormat);
    if (match) {
      return match[1].trim();
    }
  } else if (platform === "여기어때") {
    return roomName.replace("#", "No.");
  } else if (platform === "네이버") {
    return roomName;
  }
  return "";
}

// 게스트 이름 형식 변환 함수
function formatGuestName(platform, guestName) {
  if (platform === "에어비앤비") {
    return guestName.replace(/예약 확정 - /, "");
  }
  return guestName;
}

async function processMessages(channelId, parseFunction) {
  console.log(channelId, parseFunction);
  const lastReadTs = await getLastReadTs();
  const result = await getChannelHistory(channelId, lastReadTs);

  const newMessages = result.messages.reverse();
  for (const message of newMessages) {
    try {
      if (!lastReadTs || message.ts > lastReadTs) {
        const parsedMessage = await parseFunction(message);
        if (parsedMessage) {
          console.log("새 메시지:", JSON.stringify(parsedMessage, null, 2));

          // 플랫폼별로 사용되는 필드 선택
          const platformSpecificFields = {};
          if (parsedMessage.플랫폼 === "야놀자") {
            platformSpecificFields.sender = parsedMessage.발신자 || "";
            platformSpecificFields.sender_number = parsedMessage.발신번호 || "";
            platformSpecificFields.receiver = parsedMessage.수신자 || "";
            platformSpecificFields.receiver_number = parsedMessage.수신번호 || "";
            platformSpecificFields.received_date = parsedMessage.수신날짜 || null;
          }

          // 표준화된 데이터로 변환
          const standardizedData = {
            platform: parsedMessage.플랫폼,
            reservation_status: parsedMessage.예약상태,
            accommodation_name:
              parsedMessage.숙소명 || parsedMessage.펜션명 || parsedMessage.제휴점명 || "",
            reservation_number: parsedMessage.예약번호 || "",
            guest_name: parsedMessage.게스트 || parsedMessage.예약자 || parsedMessage.고객명 || "",
            test_guest_name: formatGuestName(
              parsedMessage.플랫폼,
              parsedMessage.게스트 || parsedMessage.예약자 || parsedMessage.고객명
            ),
            guest_phone: parsedMessage.연락처 || parsedMessage.휴대전화번호 || "",
            room_name: parsedMessage.객실명 || "",
            test_room_name: formatRoomName(
              parsedMessage.플랫폼,
              parsedMessage.객실명,
              parsedMessage.숙소명
            ),
            check_in_date: parsedMessage.체크인 || parsedMessage.입실일 || "",
            check_out_date: parsedMessage.체크아웃 || parsedMessage.퇴실일 || "",
            test_check_in_date: formatDate(
              parsedMessage.플랫폼,
              parsedMessage.체크인 || parsedMessage.입실일
            ),
            test_check_out_date: formatDate(
              parsedMessage.플랫폼,
              parsedMessage.체크아웃 || parsedMessage.퇴실일
            ),
            guests: parsedMessage.예약인원 || parsedMessage.인원 || 0,
            total_price: extractNumber(
              parsedMessage.총결제금액 ||
                parsedMessage.총판매가 ||
                parsedMessage.결제금액 ||
                parsedMessage.판매가격
            ),
            discount: extractNumber(parsedMessage.할인),
            coupon: extractNumber(parsedMessage.쿠폰),
            point: extractNumber(parsedMessage.포인트),
            final_price: extractNumber(parsedMessage.최종매출가),
            host_earnings: extractNumber(parsedMessage.호스트수익),
            service_fee: extractNumber(parsedMessage.서비스수수료),
            tax: extractNumber(parsedMessage.숙박세),
            request: parsedMessage.요청사항 || parsedMessage.전달사항 || parsedMessage.메시지 || "",
            pickup_status: parsedMessage.픽업여부 || "",
            remaining_rooms: parsedMessage.잔여객실 || "",
            reservation_details_url: parsedMessage.예약상세URL || "",
            message: parsedMessage.메시지 || "",
            check_in_time: parsedMessage.체크인시간 || "",
            check_out_time: parsedMessage.체크아웃시간 || "",
            payment_date: parsedMessage.결제일 || "",
            ...platformSpecificFields,
          };

          const query = `
            INSERT INTO booking_data (${Object.keys(standardizedData).join(", ")})
            VALUES (${Object.keys(standardizedData)
              .map((_, i) => `$${i + 1}`)
              .join(", ")})
          `;
          const values = Object.values(standardizedData);

          // console.log(values);
          // console.log(query);

          try {
            await pool.query(query, values);
            console.log(`${standardizedData.platform} 예약 정보가 데이터베이스에 저장되었습니다.`);
          } catch (error) {
            console.error(`데이터베이스 저장 중 오류 발생 (${standardizedData.platform}):`, error);
          }
        } else {
          console.log("메시지 파싱 결과가 null입니다.");
        }
      }
    } catch (error) {
      console.error(`Error processing individual message for ${channelId}:`, error);
      // 에러 발생 시 해당 메시지 처리를 건너뛰고 다음 메시지로 진행
      continue;
    }
  }

  if (newMessages.length > 0) {
    await saveLastReadTs(newMessages[newMessages.length - 1].ts);
  }
}

async function checkAllChannels() {
  console.log("[CHECK] slack inbound message queue");
  try {
    await Promise.all([
      processMessages(config.CHANNEL_ID_YANOLJA, parseYanoljaMessage),
      processMessages(config.CHANNEL_ID_NAVER_BOOKING, parseNaverBookingMessage),
      processMessages(config.CHANNEL_ID_AIRBNB, parseAirbnbMessage),
      processMessages(config.CHANNEL_ID_YEOGI, parseYeogiMessage),
    ]);
  } catch (error) {
    console.error("에러 발생:", error);
  }
}

// 30초마다 모든 채널 확인
cron.schedule("*/30 * * * * *", () => {
  checkAllChannels();
});

console.log("Slack 메시지 폴러가 시작되었습니다.");

// 초기 실행
checkAllChannels();

// 데이터베이스 연결 테스트
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err);
  } else {
    console.log("데이터베이스에 성공적으로 연결되었습니다.");
  }
});
