/**
 * HTML 파일 다운로드 및 처리를 위한 공통 유틸리티
 */
const axios = require("axios");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const stream = require("stream");
const { promisify } = require("util");
const { createLogger } = require("./logger");

const logger = createLogger("FILE_DOWNLOADER");
const finished = promisify(stream.finished);

/**
 * Slack에서 HTML 파일을 다운로드하고 내용을 반환합니다
 * @param {string} url - 다운로드할 파일 URL
 * @param {string} fileId - 파일 식별자
 * @returns {Promise<string>} HTML 내용
 */
async function downloadAndReadHtml(url, fileId) {
  const downloadPath = path.join(__dirname, "..", "..", "downloads");
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
    await fsPromises.unlink(filePath);

    return htmlContent;
  } catch (error) {
    logger.error("DOWNLOADING", `Error downloading file ${fileId}:`, error);
    throw new Error(`HTML 파일 다운로드 실패: ${error.message}`);
  }
}

module.exports = { downloadAndReadHtml };
