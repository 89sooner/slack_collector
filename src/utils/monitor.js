/**
 * 애플리케이션 상태 모니터링 유틸리티
 */
const os = require("os");
const { createLogger } = require("./logger");
const logger = createLogger("MONITOR");
const { reservationCache } = require("./cache");

class AppMonitor {
  constructor() {
    this.startTime = Date.now();
    this.stats = {
      messagesProcessed: 0,
      messagesSaved: 0,
      messagesFailedParsing: 0,
      messagesByPlatform: {
        airbnb: 0,
        naver: 0,
        yanolja: 0,
        yeogi: 0,
      },
      errors: 0,
      lastError: null,
    };
  }

  /**
   * 처리된 메시지 수 증가
   * @param {string} platform - 메시지 플랫폼
   */
  incrementProcessed(platform) {
    this.stats.messagesProcessed++;
    if (platform && this.stats.messagesByPlatform[platform.toLowerCase()]) {
      this.stats.messagesByPlatform[platform.toLowerCase()]++;
    }
  }

  /**
   * 저장된 메시지 수 증가
   */
  incrementSaved() {
    this.stats.messagesSaved++;
  }

  /**
   * 파싱 실패 수 증가
   */
  incrementFailedParsing() {
    this.stats.messagesFailedParsing++;
  }

  /**
   * 에러 수 증가 및 마지막 에러 기록
   * @param {Error} error - 발생한 에러
   */
  recordError(error) {
    this.stats.errors++;
    this.stats.lastError = {
      message: error.message,
      time: new Date().toISOString(),
    };
  }

  /**
   * 현재 시스템 상태 반환
   * @returns {Object} 시스템 상태 정보
   */
  getSystemStatus() {
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: {
        total: Math.round(os.totalmem() / (1024 * 1024)) + " MB",
        free: Math.round(os.freemem() / (1024 * 1024)) + " MB",
        usage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100) + "%",
      },
      cpu: os.loadavg(),
      platform: os.platform(),
      nodeVersion: process.version,
    };
  }

  /**
   * 전체 애플리케이션 상태 보고서 생성
   * @returns {Object} 상태 보고서
   */
  generateReport() {
    return {
      appStats: this.stats,
      system: this.getSystemStatus(),
      cache: reservationCache.getStats(),
    };
  }

  /**
   * 현재 상태를 로그에 기록
   */
  logStatus() {
    const report = this.generateReport();
    logger.info("STATUS", "애플리케이션 상태 보고서:", report);
  }
}

// 싱글톤 인스턴스
const monitor = new AppMonitor();

module.exports = { monitor };
