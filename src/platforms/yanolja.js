function parseYanoljaMessage(message) {
  const text = message.text || "";
  return parseMessageContent(text);
}

function parseMessageContent(text) {
  const lines = text.split("\n");
  let parsedContent = {
    플랫폼: "야놀자",
    수신날짜: "",
    발신번호: "",
    발신자: "",
    수신번호: "",
    수신자: "",
    예약상태: "",
    펜션명: "",
    예약번호: "",
    예약자: "",
    연락처: "",
    객실명: "",
    입실일: "",
    퇴실일: "",
    이용기간: "",
    판매가격: "",
    픽업여부: "",
  };

  lines.forEach((line) => {
    if (line.includes("[수신날짜]")) {
      parsedContent.수신날짜 = line.split("]")[1].trim();
    } else if (line.includes("[발신번호]")) {
      const parts = line.split("]")[1].split("(");
      parsedContent.발신번호 = parts[0].trim();
      parsedContent.발신자 = parts[1] ? parts[1].replace(")", "").trim() : "";
    } else if (line.includes("[수신번호]")) {
      const parts = line.split("]")[1].split("[");
      parsedContent.수신번호 = parts[0].trim();
      parsedContent.수신자 = parts[1] ? parts[1].replace("]", "").trim() : "";
    } else if (line.includes("[야놀자펜션 - ")) {
      parsedContent.예약상태 = line.includes("예약완료")
        ? "예약완료"
        : line.includes("예약취소")
        ? "예약취소"
        : "기타";
    } else if (line.includes("펜션명 :")) {
      parsedContent.펜션명 = line.split(":")[1].trim();
    } else if (line.includes("야놀자펜션 예약번호 :")) {
      parsedContent.예약번호 = line.split(":")[1].trim();
    } else if (line.includes("예약자 :")) {
      parsedContent.예약자 = line.split(":")[1].trim();
    } else if (line.includes("연락처 :")) {
      parsedContent.연락처 = line.split(":")[1].trim();
    } else if (line.includes("객실명 :")) {
      parsedContent.객실명 = line.split(":")[1].trim();
    } else if (line.includes("입실일 :")) {
      parsedContent.입실일 = line.split(":")[1].trim();
    } else if (line.includes("퇴실일 :")) {
      parsedContent.퇴실일 = line.split(":")[1].trim();
    } else if (line.includes("이용기간:")) {
      parsedContent.이용기간 = line.split(":")[1].trim();
    } else if (line.includes("판매가격:")) {
      parsedContent.판매가격 = line.split(":")[1].trim();
    } else if (line.includes("픽업여부:")) {
      parsedContent.픽업여부 = line.split(":")[1].trim();
    }
  });

  return parsedContent;
}

module.exports = { parseYanoljaMessage };