function parseNaverBookingMessage(message) {
  if (message.files && message.files.length > 0) {
    const fileContent = message.files[0].plain_text || "";
    return parseMessageContent(fileContent);
  }
  return null; // 파일이 없는 경우 null 반환
}

function parseMessageContent(text) {
  let parsedContent = {
    플랫폼: "네이버 예약",
    예약상태: "",
    예약번호: "",
    예약자: "",
    연락처: "",
    숙소명: "",
    객실명: "",
    체크인: "",
    체크아웃: "",
    인원: "",
    결제금액: "",
    요청사항: "",
  };

  // 숙소명 추출
  const 숙소명Match = text.match(
    /^(.+)\n입금이 완료 되어 예약이 확정 되었습니다/m
  );
  if (숙소명Match) {
    parsedContent.숙소명 = 숙소명Match[1].trim();
  }

  // 예약상태
  if (text.includes("입금이 완료 되어 예약이 확정 되었습니다")) {
    parsedContent.예약상태 = "예약완료";
  }

  // 예약자 추출
  const 예약자Match = text.match(/예약자명\s+(.+)님/);
  if (예약자Match) {
    parsedContent.예약자 = 예약자Match[1].trim();
  }

  // 예약번호 추출
  const 예약번호Match = text.match(/예약번호\s+(\d+)/);
  if (예약번호Match) {
    parsedContent.예약번호 = 예약번호Match[1];
  }

  // 객실명 추출
  const 객실명Match = text.match(/예약상품\s+(.+)/);
  if (객실명Match) {
    parsedContent.객실명 = 객실명Match[1].trim();
  }

  // 체크인, 체크아웃 추출
  const 이용일시Match = text.match(
    /이용일시\s+(\d{4}\.\d{2}\.\d{2})\.\(.+?\)~(\d{4}\.\d{2}\.\d{2})\.\(.+?\)/
  );
  if (이용일시Match) {
    parsedContent.체크인 = 이용일시Match[1];
    parsedContent.체크아웃 = 이용일시Match[2];
  }

  // 결제금액 추출
  const 결제금액Match = text.match(/결제금액.+?(\d{1,3}(,\d{3})*원)/);
  if (결제금액Match) {
    parsedContent.결제금액 = 결제금액Match[1];
  }

  // 요청사항 추출
  const 요청사항Match = text.match(/요청사항\s+(.+)/);
  if (요청사항Match) {
    parsedContent.요청사항 = 요청사항Match[1].trim();
  }

  return parsedContent;
}

module.exports = { parseNaverBookingMessage };
