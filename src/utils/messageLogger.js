// utils/messageLogger.js

const fs = require("fs");
const path = require("path");

// 로그 파일 경로 설정
const logDir = path.join(__dirname, "..", "logs");
const logFile = path.join(logDir, "message_logs.txt");

// 로그 디렉토리가 없으면 생성
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// 메시지를 파일에 로깅하는 함수
function logMessageToFile(message) {
  const logEntry = `${new Date().toISOString()} - ${JSON.stringify(message)}\n`;
  fs.appendFileSync(logFile, logEntry);
}

module.exports = {
  logMessageToFile,
  logFile,
};
