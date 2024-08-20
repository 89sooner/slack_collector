const { WebClient } = require("@slack/web-api");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

// Slack 웹 클라이언트 초기화
const web = new WebClient(process.env.SLACK_BOT_TOKEN);

// 특정 채널 ID를 지정합니다.
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

// 마지막으로 읽은 메시지의 타임스탬프를 저장할 파일
const LAST_READ_TS_FILE = path.join(__dirname, "last_read_ts.json");

// 마지막으로 읽은 타임스탬프를 가져오는 함수
async function getLastReadTs() {
  try {
    const data = await fs.readFile(LAST_READ_TS_FILE, "utf8");
    return JSON.parse(data).lastReadTs;
  } catch (error) {
    // 파일이 없거나 읽을 수 없는 경우 null 반환
    return null;
  }
}

// 마지막으로 읽은 타임스탬프를 저장하는 함수
async function saveLastReadTs(ts) {
  await fs.writeFile(LAST_READ_TS_FILE, JSON.stringify({ lastReadTs: ts }));
}

// 메시지의 전체 내용을 가져오고 첨부파일 및 블록 내용을 포함하는 함수
async function getFullMessageContent(message) {
  let messageContent = {
    text: message.text || "",
    user: message.user || "",
    timestamp: message.ts || "",
    files: [],
  };

  // 파일 정보 추가
  if (message.files && message.files.length > 0) {
    message.files.forEach((file) => {
      let fileInfo = {
        name: file.name,
        type: file.filetype,
        size: file.size,
        title: file.title || "",
        subject: file.subject || "",
        attachmentCount: file.original_attachment_count || 0,
        url: file.url_private,
        emailContent: "",
      };

      // 이메일 내용 추가
      if (file.plain_text) {
        fileInfo.emailContent = file.plain_text;
      }

      messageContent.files.push(fileInfo);
    });
  }

  return messageContent;
}

function parseMessageContent(text) {
  const lines = text.split("\n");
  let parsedContent = {
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

async function getFullMessageContent(message) {
  let messageContent = {
    originalText: message.text || "",
    user: message.user || "",
    timestamp: message.ts || "",
    files: [],
    parsedContent: {},
  };

  if (messageContent.originalText) {
    messageContent.parsedContent = parseMessageContent(
      messageContent.originalText
    );
  }

  // 파일 정보 추가 (이전과 동일)
  if (message.files && message.files.length > 0) {
    message.files.forEach((file) => {
      let fileInfo = {
        name: file.name,
        type: file.filetype,
        size: file.size,
        title: file.title || "",
        subject: file.subject || "",
        attachmentCount: file.original_attachment_count || 0,
        url: file.url_private,
        emailContent: "",
      };

      if (file.plain_text) {
        fileInfo.emailContent = file.plain_text;
      }

      messageContent.files.push(fileInfo);
    });
  }

  return messageContent;
}
async function getFullMessageContent(message) {
  let messageContent = {
    originalText: message.text || "",
    user: message.user || "",
    timestamp: message.ts || "",
    files: [],
    parsedContent: {},
  };

  if (messageContent.originalText) {
    messageContent.parsedContent = parseMessageContent(
      messageContent.originalText
    );
  }

  // 파일 정보 추가 (이전과 동일)
  if (message.files && message.files.length > 0) {
    message.files.forEach((file) => {
      let fileInfo = {
        name: file.name,
        type: file.filetype,
        size: file.size,
        title: file.title || "",
        subject: file.subject || "",
        attachmentCount: file.original_attachment_count || 0,
        url: file.url_private,
        emailContent: "",
      };

      if (file.plain_text) {
        fileInfo.emailContent = file.plain_text;
      }

      messageContent.files.push(fileInfo);
    });
  }

  return messageContent;
}

async function checkChannelMessages() {
  try {
    const lastReadTs = await getLastReadTs();

    const result = await web.conversations.history({
      channel: SLACK_CHANNEL_ID,
      oldest: lastReadTs,
    });

    // 새 메시지 처리
    const newMessages = result.messages.reverse();
    for (const message of newMessages) {
      if (!lastReadTs || message.ts > lastReadTs) {
        const messageContent = await getFullMessageContent(message);
        console.log("새 메시지:", JSON.stringify(messageContent, null, 2));
        // 여기에 메시지 처리 로직 추가
        // 예: 데이터베이스에 저장, 다른 서비스로 전달 등
      }
    }

    // 마지막 확인 시간 업데이트 및 저장
    if (newMessages.length > 0) {
      await saveLastReadTs(newMessages[newMessages.length - 1].ts);
    }
  } catch (error) {
    console.error("에러 발생:", error);
  }
}

// 1분마다 메시지 확인
setInterval(checkChannelMessages, 6000);

console.log("Slack 메시지 폴러가 시작되었습니다.");

// 초기 실행
checkChannelMessages();
