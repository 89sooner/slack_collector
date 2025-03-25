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
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  API_ENABLE: process.env.API_ENABLE || "false",
  API_PORT: process.env.API_PORT || 8090,
  BACKUP_ENABLED: process.env.BACKUP_ENABLED || "false",
  BACKUP_INTERVAL_DAYS: parseInt(process.env.BACKUP_INTERVAL_DAYS || "1", 10),
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || "30", 10),
};
