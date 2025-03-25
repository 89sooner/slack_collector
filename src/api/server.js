/**
 * 예약 데이터 접근을 위한 API 서버
 */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("../../config/config");
const { createLogger } = require("../utils/logging/logger");
const { executeQuery } = require("../utils/db");
const { monitor } = require("../utils/monitor");

const logger = createLogger("API_SERVER");
const app = express();
const PORT = config.API_PORT;

// 미들웨어 설정
app.use(helmet()); // 보안 헤더 설정
app.use(cors()); // CORS 활성화
app.use(express.json());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  logger.info("REQUEST", `${req.method} ${req.url}`);
  next();
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  logger.error("SERVER", "서버 오류:", err);
  res.status(500).json({ error: "서버 오류가 발생했습니다" });
});

// 헬스 체크 엔드포인트
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// 시스템 상태 엔드포인트
app.get("/status", (req, res) => {
  res.status(200).json(monitor.generateReport());
});

// 예약 목록 조회 엔드포인트
app.get("/reservations", async (req, res) => {
  try {
    const { platform, status, limit = 50, offset = 0 } = req.query;

    // 쿼리 조건 구성
    let conditions = [];
    let params = [];

    if (platform) {
      conditions.push(`platform = $${params.length + 1}`);
      params.push(platform);
    }

    if (status) {
      conditions.push(`reservation_status = $${params.length + 1}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 메인 쿼리
    const query = `
      SELECT * FROM reservations
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(parseInt(limit), parseInt(offset));

    // 총 개수 쿼리
    const countQuery = `
      SELECT COUNT(*) as total FROM reservations ${whereClause}
    `;

    const [results, countResult] = await Promise.all([
      executeQuery(query, params),
      executeQuery(countQuery, params.slice(0, params.length - 2)),
    ]);

    res.status(200).json({
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      results: results.rows,
    });
  } catch (error) {
    logger.error("QUERY", "예약 목록 조회 중 오류:", error);
    res.status(500).json({ error: "예약 목록을 조회하는 중 오류가 발생했습니다" });
  }
});

// 단일 예약 조회 엔드포인트
app.get("/reservations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = "SELECT * FROM reservations WHERE id = $1";
    const result = await executeQuery(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "예약을 찾을 수 없습니다" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    logger.error("QUERY", "단일 예약 조회 중 오류:", error);
    res.status(500).json({ error: "예약을 조회하는 중 오류가 발생했습니다" });
  }
});

/**
 * API 서버 시작
 */
function startServer() {
  app.listen(PORT, () => {
    logger.success("SERVER", `API 서버가 포트 ${PORT}에서 실행 중입니다`);
  });
}

module.exports = { startServer, app };
