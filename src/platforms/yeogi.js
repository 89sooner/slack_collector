const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const stream = require("stream");
const { promisify } = require("util");

const finished = promisify(stream.finished);

function validateAndLogParsedContent(parsedContent) {
  const commonRequiredFields = [
    "제휴점명",
    "예약번호",
    "결제일",
    "체크인",
    "체크아웃",
    "투숙기간",
    "고객명",
    "연락처",
  ];

  const statusSpecificFields = {
    예약확정: ["객실명", "총판매가", "총입금가"],
    예약대기: ["객실명"],
    예약취소: [],
  };

  let requiredFields = [...commonRequiredFields];
  if (statusSpecificFields[parsedContent.예약상태]) {
    requiredFields = [
      ...requiredFields,
      ...statusSpecificFields[parsedContent.예약상태],
    ];
  }

  let isValid = true;

  requiredFields.forEach((field) => {
    if (!parsedContent[field]) {
      console.warn(`Warning: ${field} is empty or missing`);
      isValid = false;
    }
  });

  // 예약대기 상태일 때 잔여객실 정보가 없어도 됨
  if (parsedContent.예약상태 !== "예약대기" && !parsedContent.잔여객실) {
    console.warn(`Warning: 잔여객실 is empty or missing`);
    isValid = false;
  }

  console.log("Parsed content:", JSON.stringify(parsedContent, null, 2));
  console.log("Is valid:", isValid);

  return isValid;
}

async function parseYeogiMessage(message) {
  if (message.files && message.files.length > 0) {
    const file = message.files[0];
    if (file.url_private_download) {
      try {
        const htmlContent = await downloadAndReadHtml(
          file.url_private_download,
          file.id
        );

        // parseYeogiMessage 함수 내에서 사용
        const parsedContent = parseHtmlContent(htmlContent, file.title);
        validateAndLogParsedContent(parsedContent);

        // 각 필드를 개별적으로 로깅
        // Object.entries(parsedContent).forEach(([key, value]) => {
        //   console.log(`${key}: "${value}"`);
        // });
        console.log("===============================");
        return parsedContent;
      } catch (error) {
        console.error("Error downloading or parsing HTML content:", error);
        console.log("Falling back to plain text parsing");
        return parseMessageContent(file);
      }
    } else {
      console.log("No private download URL, using plain text parsing");
      return parseMessageContent(file);
    }
  }
  console.log("No files found in the message");
  return null; // 파일이 없는 경우 null 반환
}

async function downloadAndReadHtml(url, fileId) {
  const downloadPath = path.join(__dirname, "..", "..", "downloads");
  const filePath = path.join(downloadPath, `${fileId}.html`);

  // 다운로드 디렉토리 생성
  await fsPromises.mkdir(downloadPath, { recursive: true });

  // 파일 다운로드
  const response = await axios({
    method: "get",
    url: url,
    responseType: "stream",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
  });

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  await finished(writer);

  // 파일 읽기
  const htmlContent = await fsPromises.readFile(filePath, "utf8");

  // 파일 삭제 (선택사항)
  await fsPromises.unlink(filePath);

  return htmlContent;
}

function parseHtmlContent(html, title) {
  const $ = cheerio.load(html);
  let parsedContent = {
    플랫폼: "여기어때",
    예약상태: "",
    제휴점명: "",
    예약번호: "",
    결제일: "",
    체크인: "",
    체크아웃: "",
    투숙기간: "",
    고객명: "",
    연락처: "",
    객실명: "",
    잔여객실: "",
    총판매가: "",
    총입금가: "",
    할인: "",
    쿠폰: "",
    포인트: "",
    최종매출가: "",
    전달사항: "",
  };

  // 제목에서 예약 상태 파싱
  if (title.includes("예약 취소")) {
    parsedContent.예약상태 = "예약취소";
  } else if (title.includes("예약대기")) {
    parsedContent.예약상태 = "예약대기";
  } else if (title.includes("예약 확정")) {
    parsedContent.예약상태 = "예약확정";
  } else {
    parsedContent.예약상태 = "알 수 없음";
  }

  // 제목에서 예약번호 파싱
  const reservationNumberMatch = title.match(/\d{14}YE1/);
  if (reservationNumberMatch) {
    parsedContent.예약번호 = reservationNumberMatch[0];
  }

  // 모든 테이블을 순회하며 정보 추출
  $("table").each((index, table) => {
    const tableHtml = $(table).html();

    // 제휴점명, 예약번호, 결제일 파싱
    if (
      tableHtml.includes("제휴점명") ||
      tableHtml.includes("예약번호") ||
      tableHtml.includes("결제일")
    ) {
      $(table)
        .find("tr")
        .each((i, row) => {
          const text = $(row).text().trim();
          if (text.includes("제휴점명")) {
            parsedContent.제휴점명 = text.split(":")[1].trim();
          } else if (text.includes("예약번호") && !parsedContent.예약번호) {
            // 이미 제목에서 파싱한 예약번호가 없을 경우에만 업데이트
            parsedContent.예약번호 = text.split(":")[1].trim();
          } else if (text.includes("결제일")) {
            parsedContent.결제일 = text.split("결제일 :")[1].trim();
          }
        });
    }

    // 예약 내역 테이블 파싱
    if (tableHtml.includes("체크인") && tableHtml.includes("체크아웃")) {
      const rows = $(table).find("tr");
      if (rows.length >= 2) {
        const columns = rows.eq(1).find("td");
        parsedContent.체크인 = columns.eq(0).text().replace(/\s+/g, " ").trim();
        parsedContent.체크아웃 = columns
          .eq(1)
          .text()
          .replace(/\s+/g, " ")
          .trim();
        parsedContent.투숙기간 = columns.eq(2).text().trim();
        parsedContent.고객명 = columns.eq(3).text().trim();
        parsedContent.연락처 = columns.eq(4).text().trim();
      }
    }

    // 객실 정보 파싱
    if (tableHtml.includes("객실명")) {
      const roomInfoText = $(table)
        .find("tr")
        .eq(0)
        .find("td")
        .eq(1)
        .text()
        .trim();
      const roomInfoParts = roomInfoText.split("잔여 객실");
      parsedContent.객실명 = roomInfoParts[0].trim();
      if (roomInfoParts.length > 1) {
        parsedContent.잔여객실 = roomInfoParts[1].trim();
      } else if (parsedContent.예약상태 !== "예약대기") {
        parsedContent.잔여객실 = "정보 없음";
      }
    }

    // 결제 내역 파싱
    if (tableHtml.includes("총 판매가") && tableHtml.includes("최종 매출가")) {
      const paymentRows = $(table).find("tr");
      if (paymentRows.length >= 2) {
        const columns = paymentRows.eq(1).find("td");
        parsedContent.총판매가 = columns.eq(0).text().trim();
        parsedContent.총입금가 = columns.eq(1).text().trim();
        parsedContent.할인 = columns.eq(2).text().trim();
        parsedContent.쿠폰 = columns.eq(3).text().trim();
        parsedContent.포인트 = columns.eq(4).text().trim();
        parsedContent.최종매출가 = columns.eq(5).text().trim();
      }
    }
  });

  // 전달사항 파싱
  const transmissionSection = $('td:contains("전달사항")').next();
  parsedContent.전달사항 = transmissionSection
    .find("li")
    .map((index, element) => $(element).text().trim())
    .get()
    .join(" ");

  return parsedContent;
}

// 기존의 parseMessageContent 함수는 그대로 유지
function parseMessageContent(file) {
  let parsedContent = {
    플랫폼: "여기어때",
    예약상태: "예약완료",
    제휴점명: "",
    예약번호: "",
    결제일: "",
    체크인: "",
    체크아웃: "",
    투숙기간: "",
    고객명: "",
    연락처: "",
    객실명: "",
    총판매가: "",
    총입금가: "",
    할인: "",
    쿠폰: "",
    포인트: "",
    최종매출가: "",
    전달사항: "",
  };

  const text = file.plain_text;
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("제휴점명 :")) {
      parsedContent.제휴점명 = line.split(":")[1].trim();
    } else if (line.startsWith("예약번호 :")) {
      parsedContent.예약번호 = line.split(":")[1].trim();
    } else if (line.startsWith("결제일 :")) {
      parsedContent.결제일 = line.split(":")[1].trim();
    } else if (line.startsWith("체크인")) {
      parsedContent.체크인 = lines[i + 1].trim();
    } else if (line.startsWith("체크아웃")) {
      parsedContent.체크아웃 = lines[i + 1].trim();
    } else if (line.startsWith("투숙기간")) {
      parsedContent.투숙기간 = lines[i + 1].trim();
    } else if (line.startsWith("고객명")) {
      parsedContent.고객명 = lines[i + 1].trim();
    } else if (line.startsWith("연락처")) {
      parsedContent.연락처 = lines[i + 1].trim();
    } else if (line.startsWith("객실명")) {
      parsedContent.객실명 = lines[i + 1].trim();
    } else if (line.includes("총 판매가")) {
      parsedContent.총판매가 = line.split("총 판매가")[1].trim();
    } else if (line.includes("총 입금가")) {
      parsedContent.총입금가 = line.split("총 입금가")[1].trim();
    } else if (line.includes("할인")) {
      parsedContent.할인 = line.split("할인")[1].trim();
    } else if (line.includes("쿠폰")) {
      parsedContent.쿠폰 = line.split("쿠폰")[1].trim();
    } else if (line.includes("포인트")) {
      parsedContent.포인트 = line.split("포인트")[1].trim();
    } else if (line.includes("최종 매출가")) {
      parsedContent.최종매출가 = line.split("최종 매출가")[1].trim();
    }
  }

  // 전달사항 추출 (여러 줄일 수 있음)
  const 전달사항Index = text.indexOf("전달사항");
  if (전달사항Index !== -1) {
    const 전달사항End = text.indexOf("파트너센터 URL:", 전달사항Index);
    if (전달사항End !== -1) {
      parsedContent.전달사항 = text
        .slice(전달사항Index + "전달사항".length, 전달사항End)
        .trim();
    }
  }

  // 추가 메타데이터
  parsedContent.이메일제목 = file.title || "";
  parsedContent.첨부파일명 = file.name || "";
  parsedContent.생성일시 = new Date(file.created * 1000).toISOString();

  return parsedContent;
}

module.exports = { parseYeogiMessage };
