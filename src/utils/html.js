/**
 * HTML 관련 유틸리티 함수들
 */

/**
 * HTML 엔티티를 디코딩합니다
 * @param {string} text - 디코딩할 텍스트
 * @returns {string} 디코딩된 텍스트
 */
function decodeHtmlEntities(text) {
  if (!text) return "";

  const entities = {
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
  };

  return text.replace(/&[a-z]+;|&#\d+;/g, function (match) {
    if (entities[match]) {
      return entities[match];
    }

    // 숫자 엔티티 처리 (예: &#123;)
    if (match.startsWith("&#")) {
      const numericValue = match.match(/&#(\d+);/)[1];
      return String.fromCharCode(parseInt(numericValue, 10));
    }

    // 알 수 없는 엔티티는 그대로 반환
    return match;
  });
}

/**
 * HTML 태그를 제거합니다
 * @param {string} text - 태그를 제거할 텍스트
 * @returns {string} 태그가 제거된 텍스트
 */
function stripHtmlTags(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "");
}

/**
 * 텍스트를 HTML 엔티티로 인코딩합니다
 * @param {string} text - 인코딩할 텍스트
 * @returns {string} 인코딩된 텍스트
 */
function encodeHtmlEntities(text) {
  if (!text) return "";

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  decodeHtmlEntities,
  stripHtmlTags,
  encodeHtmlEntities,
};
