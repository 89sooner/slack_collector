// src/utils/logging/logger.js
const chalk = require("chalk");
const path = require("path");

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
    DEBUG: "DEBUG", // 새로 추가된 디버그 레벨
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

  _getCallerInfo() {
    const err = new Error();
    Error.captureStackTrace(err, this._getCallerInfo);

    const stackLines = err.stack.split("\n");

    let callerLine = "";
    for (let i = 1; i < stackLines.length; i++) {
      const line = stackLines[i].trim();
      if (!line.includes("logger.js")) {
        callerLine = line;
        break;
      }
    }

    if (!callerLine) return "unknown:0";

    const match = callerLine.match(/at\s+(?:.*\s+\()?(?:(.+):(\d+):(\d+))/);
    if (match) {
      const [, filePath, line, column] = match;
      const fileName = path.basename(filePath);
      return `${fileName}:${line}`;
    }

    return "unknown:0";
  }

  _formatMessage(operation, status, message, data = null) {
    const timestamp = this._getTimestamp();
    const callerInfo = this._getCallerInfo();
    const baseMsg = `[${timestamp}] [${this.platform}] [${operation}] [${status}] [${callerInfo}] ${message}`;

    if (data) {
      return `${baseMsg}\n${JSON.stringify(data, null, 2)}`;
    }
    return baseMsg;
  }

  _logWithColor(color, operation, status, message, data = null) {
    console.log(chalk[color](this._formatMessage(operation, status, message, data)));
  }

  debug(operation, message, data = null) {
    this._logWithColor("cyan", operation, Logger.STATUS.DEBUG, message, data);
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
