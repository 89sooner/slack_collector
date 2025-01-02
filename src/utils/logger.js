// src/utils/logger.js
const chalk = require("chalk");

class Logger {
  static PLATFORMS = {
    NAVER: "NAVER",
    AIRBNB: "AIRBNB",
    YANOLJA: "YANOLJA",
    YEOGI: "YEOGI",
  };

  static OPERATIONS = {
    PARSING: "PARSING",
    DOWNLOADING: "DOWNLOADING",
    SAVING: "SAVING",
  };

  static STATUS = {
    INFO: "INFO",
    SUCCESS: "SUCCESS",
    WARNING: "WARNING",
    ERROR: "ERROR",
  };

  constructor(platform) {
    this.platform = platform;
  }

  _getTimestamp() {
    return new Date().toISOString();
  }

  _formatMessage(operation, status, message, data = null) {
    const timestamp = this._getTimestamp();
    const baseMsg = `[${timestamp}] [${this.platform}] [${operation}] [${status}] ${message}`;

    if (data) {
      return `${baseMsg}\n${JSON.stringify(data, null, 2)}`;
    }
    return baseMsg;
  }

  _logWithColor(color, operation, status, message, data = null) {
    console.log(chalk[color](this._formatMessage(operation, status, message, data)));
  }

  info(operation, message, data = null) {
    this._logWithColor("blue", operation, Logger.STATUS.INFO, message, data);
  }

  success(operation, message, data = null) {
    this._logWithColor("green", operation, Logger.STATUS.SUCCESS, message, data);
  }

  warning(operation, message, data = null) {
    this._logWithColor("yellow", operation, Logger.STATUS.WARNING, message, data);
  }

  error(operation, message, error = null) {
    const errorData = error
      ? {
          message: error.message,
          stack: error.stack,
          timestamp: this._getTimestamp(),
        }
      : null;
    this._logWithColor("red", operation, Logger.STATUS.ERROR, message, errorData);
  }

  // 공통 작업별 로깅 헬퍼 메소드
  startOperation(operation, data = null) {
    this.info(operation, `Starting ${operation.toLowerCase()} operation`, data);
  }

  endOperation(operation, data = null) {
    this.success(operation, `${operation.toLowerCase()} operation completed`, data);
  }

  operationFailed(operation, error) {
    this.error(operation, `${operation.toLowerCase()} operation failed`, error);
  }
}

// 플랫폼별 로거 인스턴스 생성 함수
function createLogger(platform) {
  return new Logger(platform);
}

module.exports = {
  Logger,
  createLogger,
};
