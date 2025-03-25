/**
 * formatHandler 유틸리티 테스트
 */
const { expect } = require("chai");
const {
  extractNumber,
  formatDate,
  formatRoomName,
  formatGuestName,
  parseDate,
} = require("../../utils/formatHandler");

describe("formatHandler 유틸리티", () => {
  describe("extractNumber 함수", () => {
    it("숫자와 쉼표, 통화 기호가 포함된 문자열에서 숫자를 추출해야 함", () => {
      expect(extractNumber("₩123,456원")).to.equal(123456);
      expect(extractNumber("1,234.56")).to.equal(1234.56);
      expect(extractNumber("-9,876.54")).to.equal(-9876.54);
    });

    it("숫자가 아닌 값을 전달하면 0을 반환해야 함", () => {
      expect(extractNumber(null)).to.equal(0);
      expect(extractNumber(undefined)).to.equal(0);
      expect(extractNumber("")).to.equal(0);
    });
  });

  describe("formatDate 함수", () => {
    it("에어비앤비 날짜 형식 처리", () => {
      expect(formatDate("에어비앤비", "12월 25일 (월)", "예약확정")).to.equal(
        `${new Date().getFullYear()}-12-25`
      );
      expect(formatDate("에어비앤비", "2026년 1월 5일", "예약확정")).to.equal("2026-01-05");
    });

    it("야놀자 날짜 형식 처리", () => {
      expect(formatDate("야놀자", "2025-06-15(목)", "예약확정")).to.equal("2025-06-15");
    });

    it("네이버 날짜 형식 처리", () => {
      expect(formatDate("네이버", "2025.07.22", "예약확정")).to.equal("2025-07-22");
    });
  });

  // ... 기타 테스트 케이스 ...
});
