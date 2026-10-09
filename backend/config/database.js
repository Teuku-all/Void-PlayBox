const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './database/playbox.db';
const dbPath = path.resolve(DB_PATH);

let db;

function getDb() {
  if (!db) {
    // better-sqlite3 tidak membuat folder otomatis
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

module.exports = { getDb };
