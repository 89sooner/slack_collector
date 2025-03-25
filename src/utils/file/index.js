/**
 * 파일 관련 모듈 export
 */
const { getLastReadTs, saveLastReadTs } = require("./fileHandler");
const { createBackup, cleanOldBackups } = require("./backupManager");

module.exports = {
  getLastReadTs,
  saveLastReadTs,
  createBackup,
  cleanOldBackups,
};
