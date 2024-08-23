require("dotenv").config();

module.exports = {
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  CHANNEL_ID_YANOLJA: process.env.CHANNEL_ID_YANOLJA,
  CHANNEL_ID_NAVER_BOOKING: process.env.CHANNEL_ID_NAVER_BOOKING,
  CHANNEL_ID_AIRBNB: process.env.CHANNEL_ID_AIRBNB,
  CHANNEL_ID_YEOGI: process.env.CHANNEL_ID_YEOGI,
};
