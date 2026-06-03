// =============================================
// HPPYS — Database Manager (sql.js / SQLite)
// =============================================

const path = require('path');
const fs   = require('fs');
const { app } = require('electron');

let db = null;
let SQL = null;
let dbPath = null;

async function initDb() {
  if (db) return db;

  const initSqlite3 = require('sql.js');
  SQL = await initSqlite3({
    locateFile: file => path.join(__dirname, '../node_modules/sql.js/dist/', file)
  });

  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'hppys.db');

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  createSchema();
  saveDb();
  return db;
}

function createSchema() {
  const sqlPath = path.join(__dirname, 'init.sql');
  if (fs.existsSync(sqlPath)) {
    const schema = fs.readFileSync(sqlPath, 'utf8');
    db.run(schema);
  }
}

function saveDb() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDb() { return db; }
function getDbPath() { return dbPath; }

// Helper: run a SELECT and return array of row objects
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run INSERT/UPDATE/DELETE
function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

module.exports = { initDb, getDb, getDbPath, saveDb, query, run };
