/**
 * 간단한 메모리 캐시 구현
 */
const { createLogger } = require("./logger");
const logger = createLogger("CACHE");

class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 3600000; // 기본 TTL: 1시간
    this.maxSize = options.maxSize || 1000; // 최대 캐시 항목 수
    this.hits = 0;
    this.misses = 0;

    // 정기적인 캐시 정리
    if (options.cleanupInterval !== false) {
      const interval = options.cleanupInterval || 300000; // 기본: 5분마다 정리
      this.cleanupInterval = setInterval(() => this.cleanup(), interval);
    }
  }

  /**
   * 캐시에 항목 저장
   * @param {string} key - 캐시 키
   * @param {any} value - 저장할 값
   * @param {number} ttl - 유효 시간(ms)
   */
  set(key, value, ttl = this.ttl) {
    // 캐시가 최대 크기에 도달하면 가장 오래된 항목 제거
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      logger.info("CACHE", `캐시 크기 초과로 오래된 항목 제거: ${oldestKey}`);
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
    });
  }

  /**
   * 캐시에서 항목 조회
   * @param {string} key - 캐시 키
   * @returns {any|null} 저장된 값 또는 null
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return null;
    }

    // 만료 확인
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return item.value;
  }

  /**
   * 캐시에서 항목 삭제
   * @param {string} key - 삭제할 항목의 키
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * 캐시 비우기
   */
  clear() {
    this.cache.clear();
    logger.info("CACHE", "캐시가 초기화되었습니다.");
  }

  /**
   * 만료된 항목 정리
   */
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (item.expires < now) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.info("CACHE", `${expiredCount}개의 만료된 캐시 항목이 정리되었습니다.`);
    }
  }

  /**
   * 캐시 통계 조회
   * @returns {Object} 캐시 통계 정보
   */
  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio:
        this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)).toFixed(2) : 0,
    };
  }

  /**
   * 리소스 해제
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// 싱글톤 인스턴스 생성
const reservationCache = new MemoryCache({
  ttl: 24 * 60 * 60 * 1000, // 1일
  maxSize: 500,
});

module.exports = { MemoryCache, reservationCache };
