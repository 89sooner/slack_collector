/**
 * 데이터베이스 관련 모듈 export
 */
const db = require("./db");
const { initializeSchema } = require("./schemaManager");
const {
  initChannelStateTable,
  getChannelLastReadTs,
  saveChannelLastReadTs,
  getAllChannelStates,
} = require("./channelStateManager");

module.exports = {
  ...db,
  initializeSchema,
  initChannelStateTable,
  getChannelLastReadTs,
  saveChannelLastReadTs,
  getAllChannelStates,
};
