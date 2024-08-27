require("dotenv").config();

module.exports = {
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  CHANNEL_ID_YANOLJA: process.env.CHANNEL_ID_YANOLJA,
  CHANNEL_ID_NAVER_BOOKING: process.env.CHANNEL_ID_NAVER_BOOKING,
  CHANNEL_ID_AIRBNB: process.env.CHANNEL_ID_AIRBNB,
  CHANNEL_ID_YEOGI: process.env.CHANNEL_ID_YEOGI,
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_DATABASE: process.env.DB_DATABASE,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_PORT: process.env.DB_PORT,
};
