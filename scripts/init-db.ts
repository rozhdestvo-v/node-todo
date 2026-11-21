import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';
try {
  const sql = await readFile(new URL('../db/001_tasks.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Таблица tasks инициализирована');
} catch (error) {
  console.error('Не удалось инициализировать БД:', error);
  process.exitCode = 1;
} finally { await pool.end(); }
