/**
 * HTML 파일 다운로드 및 처리를 위한 공통 유틸리티
 */
const axios = require("axios");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const stream = require("stream");
const { promisify } = require("util");
const { createLogger } = require("../logging/logger");
const os = require("os");

const logger = createLogger("FILE_DOWNLOADER");
const finished = promisify(stream.finished);

/**
 * 환경에 따른 다운로드 경로 설정
 * Docker 환경이나 권한 문제 발생 시 시스템 임시 디렉토리 사용
 */
function getDownloadPath() {
  // 기본 다운로드 경로
  const defaultPath = path.join(__dirname, "..", "..", "..", "downloads");
  // 시스템 임시 디렉토리 (모든 사용자가 쓰기 가능)
  const tempPath = path.join(os.tmpdir(), "slack_downloads");

  try {
    // 기본 경로에 대한 접근 권한 테스트
    const testFile = path.join(defaultPath, ".write_test");
    fs.mkdirSync(defaultPath, { recursive: true });
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    return defaultPath;
  } catch (error) {
    // 권한 오류 발생 시 시스템 임시 디렉토리 사용
    logger.warning("PATH", `기본 다운로드 경로 접근 권한 없음, 임시 디렉토리 사용: ${tempPath}`);
    try {
      fs.mkdirSync(tempPath, { recursive: true });
      return tempPath;
    } catch (tmpError) {
      logger.error("PATH", `임시 디렉토리 생성 실패: ${tmpError.message}`);
      return os.tmpdir(); // 마지막 대안으로 시스템 임시 디렉토리 자체를 사용
    }
  }
}

/**
 * Slack에서 HTML 파일을 다운로드하고 내용을 반환합니다
 * @param {string} url - 다운로드할 파일 URL
 * @param {string} fileId - 파일 식별자
 * @returns {Promise<string>} HTML 내용
 */
async function downloadAndReadHtml(url, fileId) {
  const downloadPath = getDownloadPath();
  const filePath = path.join(downloadPath, `${fileId}.html`);

  try {
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

    // 파일 삭제
    try {
      await fsPromises.unlink(filePath);
    } catch (unlinkError) {
      logger.warning("CLEANUP", `임시 파일 삭제 실패: ${unlinkError.message}`);
    }

    return htmlContent;
  } catch (error) {
    // 권한 오류인 경우 메모리에 직접 다운로드 시도
    if (error.code === "EACCES") {
      logger.warning("DOWNLOADING", `파일 저장 권한 없음, 메모리에 직접 다운로드 시도: ${fileId}`);
      return downloadToMemory(url);
    }

    logger.error("DOWNLOADING", `Error downloading file ${fileId}:`, error);
    throw new Error(`HTML 파일 다운로드 실패: ${error.message}`);
  }
}

/**
 * 파일을 디스크가 아닌 메모리에 직접 다운로드합니다
 * @param {string} url - 다운로드할 URL
 * @returns {Promise<string>} 다운로드한 내용
 */
async function downloadToMemory(url) {
  try {
    const response = await axios({
      method: "get",
      url: url,
      responseType: "text", // 텍스트로 직접 받기
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
    });

    return response.data;
  } catch (error) {
    logger.error("DOWNLOADING", "메모리 다운로드 실패:", error);
    throw new Error(`메모리 다운로드 실패: ${error.message}`);
  }
}

module.exports = { downloadAndReadHtml };
