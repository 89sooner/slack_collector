function parseYeogiMessage(message) {
  if (message.files && message.files.length > 0) {
    const emailContent = message.files[0].plain_text || "";
    return parseMessageContent(emailContent);
  }
  return {};
}

function parseMessageContent(text) {
  // 여기어때에 맞는 파싱 로직 구현
  // 야놀자와 비슷한 구조로 구현하되, 여기어때 특화 필드 추가
  // ...
}

module.exports = { parseYeogiMessage };