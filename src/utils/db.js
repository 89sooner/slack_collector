// src/utils/db.js
const { Pool } = require("pg");
const config = require("../../config/config");

const pool = new Pool({
  user: config.DB_USER,
  host: config.DB_HOST,
  database: config.DB_DATABASE,
  password: config.DB_PASSWORD,
  port: config.DB_PORT,
});

module.exports = { pool };
