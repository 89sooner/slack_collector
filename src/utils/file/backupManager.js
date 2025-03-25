/**
 * 데이터베이스 백업 관리 모듈
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { format } = require("date-fns");
const { createLogger } = require("../logging/logger");

const logger = createLogger("BACKUP");
const config = require("../../../config/config");

const BACKUP_DIR = path.join(__dirname, "..", "..", "backups");

/**
 * 백업 디렉토리가 없으면 생성
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info("INIT", `백업 디렉토리 생성: ${BACKUP_DIR}`);
  }
}

/**
 * 데이터베이스 백업 실행
 * @returns {Promise<string>} 백업 파일 경로
 */
async function createBackup() {
  ensureBackupDir();

  const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
  const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.sql`);

  logger.info("BACKUP", "데이터베이스 백업 시작");

  return new Promise((resolve, reject) => {
    const pg_dump = spawn(
      "pg_dump",
      [
        "-h",
        config.DB_HOST,
        "-U",
        config.DB_USER,
        "-d",
        config.DB_DATABASE,
        "-f",
        backupFile,
        "-F",
        "p", // 일반 텍스트 SQL 형식
      ],
      {
        env: { ...process.env, PGPASSWORD: config.DB_PASSWORD },
      }
    );

    pg_dump.stdout.on("data", (data) => {
      logger.info("BACKUP", `pg_dump 출력: ${data}`);
    });

    pg_dump.stderr.on("data", (data) => {
      logger.warning("BACKUP", `pg_dump 경고: ${data}`);
    });

    pg_dump.on("close", (code) => {
      if (code === 0) {
        logger.success("BACKUP", `백업 성공: ${backupFile}`);
        resolve(backupFile);
      } else {
        logger.error("BACKUP", `백업 실패. 종료 코드: ${code}`);
        reject(new Error(`백업 실패. 종료 코드: ${code}`));
      }
    });
  });
}

/**
 * 오래된 백업 파일 정리
 * @param {number} keepDays - 보관할 기간(일)
 */
async function cleanOldBackups(keepDays = 30) {
  logger.info("CLEANUP", `${keepDays}일 이전의 백업 파일 정리 시작`);

  const cutoffTime = new Date();
  cutoffTime.setDate(cutoffTime.getDate() - keepDays);

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && stats.mtime < cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
        logger.info("CLEANUP", `오래된 백업 파일 삭제: ${file}`);
      }
    }

    logger.success("CLEANUP", `${deletedCount}개의 백업 파일 정리 완료`);
  } catch (error) {
    logger.error("CLEANUP", "백업 파일 정리 중 오류:", error);
  }
}

module.exports = { createBackup, cleanOldBackups };
