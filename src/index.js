const config = require("../config/config");
const { getChannelHistory } = require("./utils/slackClient");
const { getLastReadTs, saveLastReadTs } = require("./utils/fileHandler");
const { parseYanoljaMessage } = require("./platforms/yanolja");
const { parseNaverBookingMessage } = require("./platforms/naverbooking");
const { parseAirbnbMessage } = require("./platforms/airbnb");
const { parseYeogiMessage } = require("./platforms/yeogi");

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
          // console.log("새 메시지:", JSON.stringify(parsedMessage, null, 2));
          // 여기에 메시지 처리 로직 추가 (예: 데이터베이스에 저장)
        } else {
          console.log("메시지 파싱 결과가 null입니다.");
        }
      }
    } catch (error) {
      console.error(`Error processing individual message:`, error);
    }
  }

  if (newMessages.length > 0) {
    await saveLastReadTs(newMessages[newMessages.length - 1].ts);
  }
}

async function checkAllChannels() {
  try {
    // await processMessages(config.CHANNEL_ID_YANOLJA, parseYanoljaMessage);
    // await processMessages(
    //   config.CHANNEL_ID_NAVER_BOOKING,
    //   parseNaverBookingMessage
    // );
    await processMessages(config.CHANNEL_ID_AIRBNB, parseAirbnbMessage);
    // await processMessages(config.CHANNEL_ID_YEOGI, parseYeogiMessage);
  } catch (error) {
    console.error("에러 발생:", error);
  }
}

// 1분마다 모든 채널 확인
setInterval(checkAllChannels, 30000);

console.log("Slack 메시지 폴러가 시작되었습니다.");

// 초기 실행
checkAllChannels();
