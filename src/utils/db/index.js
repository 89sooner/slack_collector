/**
 * 데이터베이스 관련 모듈 export
 */
const db = require("./db");
const { initializeSchema } = require("./schemaManager");

module.exports = {
  ...db,
  initializeSchema,
};
