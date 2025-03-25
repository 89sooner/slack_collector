/**
 * 모든 플랫폼 파서의 기본 클래스 제공
 * 새로운 플랫폼을 추가할 때 이 클래스를 상속받아 구현
 */
const { createLogger } = require("../utils/logger");

class BasePlatformParser {
  constructor(platformName) {
    this.platformName = platformName;
    this.logger = createLogger(platformName.toUpperCase());
  }

  /**
   * 메시지 파싱
   * @param {Object} message - Slack 메시지 객체
   * @returns {Promise<Object|null>} 파싱된 데이터 또는 null
   */
  async parseMessage(message) {
    try {
      const parsedContent = await this._doParsing(message);

      if (parsedContent) {
        const isValid = this._validateContent(parsedContent);
        if (!isValid) {
          this.logger.warning("VALIDATION", "필수 필드가 누락되었습니다");
        }

        return parsedContent;
      }

      return null;
    } catch (error) {
      this.logger.error("PARSING", `${this.platformName} 메시지 파싱 중 오류:`, error);
      return null;
    }
  }

  /**
   * 실제 파싱 작업 수행 (하위 클래스에서 구현)
   * @param {Object} message - Slack 메시지 객체
   * @returns {Promise<Object|null>} 파싱된 데이터 또는 null
   */
  async _doParsing(message) {
    throw new Error("_doParsing 메소드가 구현되지 않았습니다");
  }

  /**
   * 파싱된 콘텐츠 유효성 검사 (하위 클래스에서 구현)
   * @param {Object} parsedContent - 파싱된 데이터
   * @returns {boolean} 유효성 검사 결과
   */
  _validateContent(parsedContent) {
    throw new Error("_validateContent 메소드가 구현되지 않았습니다");
  }

  /**
   * 필수 필드 검증 헬퍼 메소드
   * @param {Object} content - 검증할 객체
   * @param {Array} requiredFields - 필수 필드 배열
   * @returns {boolean} 모든 필수 필드가 있으면 true
   */
  _validateRequiredFields(content, requiredFields) {
    let isValid = true;

    requiredFields.forEach((field) => {
      if (!content[field]) {
        this.logger.warning("VALIDATION", `필드 '${field}'가 비어있거나 누락되었습니다`);
        isValid = false;
      }
    });

    return isValid;
  }
}

module.exports = { BasePlatformParser };
