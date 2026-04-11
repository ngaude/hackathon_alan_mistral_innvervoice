import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { logInfo } from './log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Répertoire données : `server/data/` (créé au besoin). */
function getDataDir(): string {
  const dir = path.join(__dirname, '../../data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getDbPath(): string {
  return path.join(getDataDir(), 'innervoice.db');
}

export function getAudioDir(): string {
  const dir = path.join(getDataDir(), 'audio');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  const p = getDbPath();
  const db = new Database(p);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL DEFAULT '',
      mistral_voice_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      snapshot_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS session_audio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      kind TEXT NOT NULL,
      label TEXT,
      spoken_text TEXT,
      file_path TEXT NOT NULL,
      word_timings_json TEXT,
      UNIQUE(session_id, seq),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);
  dbInstance = db;
  logInfo('SQLite', { path: p });
  return db;
}
