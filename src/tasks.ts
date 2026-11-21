import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { ErrorRequestHandler } from 'express';
import { config } from './config.js';
import { pool } from './db.js';

export const tasksRouter = Router({ strict: true });
const columns = 'id, owner_login AS "ownerLogin", title, done, run_id AS "runId", created_at AS "createdAt"';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const runIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validTitle(value: unknown): value is string {
  return typeof value === 'string' && [...value.trim()].length >= 1 && [...value.trim()].length <= 200;
}

tasksRouter.post('/tasks/', async (req, res, next) => {
  const body: unknown = req.body;
  if (!object(body) || Object.keys(body).some(k => !['title', 'runId'].includes(k)) ||
      !validTitle(body.title) || typeof body.runId !== 'string' || !runIdPattern.test(body.runId)) {
    res.status(400).json({ error: 'Ожидаются только title (1–200 символов) и runId (1–64: A-Z, a-z, 0-9, _, -)' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO tasks (id, owner_login, title, done, run_id, created_at)
       VALUES ($1, $2, $3, false, $4, $5) RETURNING ${columns}`,
      [randomUUID(), config.author.login, body.title.trim(), body.runId, new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

tasksRouter.get('/tasks/', async (req, res, next) => {
  const runId = req.query.runId;
  if (typeof runId !== 'string' || !runIdPattern.test(runId)) {
    res.status(400).json({ error: 'Необходим корректный единственный runId' });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT ${columns} FROM tasks WHERE owner_login = $1 AND run_id = $2 ORDER BY created_at DESC, id`,
      [config.author.login, runId]
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

tasksRouter.param('id', (_req, res, next, id: string) => {
  if (!uuid.test(id)) { res.status(400).json({ error: 'Некорректный UUID' }); return; }
  next();
});

tasksRouter.get('/tasks/:id/', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${columns} FROM tasks WHERE id = $1 AND owner_login = $2`,
      [req.params.id, config.author.login]);
    if (!result.rows[0]) { res.status(404).json({ error: 'Дело не найдено' }); return; }
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

tasksRouter.patch('/tasks/:id/', async (req, res, next) => {
  const body: unknown = req.body;
  if (!object(body) || !Object.keys(body).length ||
      Object.keys(body).some(k => !['title', 'done'].includes(k)) ||
      ('title' in body && !validTitle(body.title)) ||
      ('done' in body && typeof body.done !== 'boolean')) {
    res.status(400).json({ error: 'Ожидается непустой набор title (1–200 символов) и/или done (boolean)' });
    return;
  }
  const values: unknown[] = [];
  const sets: string[] = [];
  if (typeof body.title === 'string') { values.push(body.title.trim()); sets.push(`title = $${values.length}`); }
  if (typeof body.done === 'boolean') { values.push(body.done); sets.push(`done = $${values.length}`); }
  values.push(req.params.id, config.author.login);
  try {
    const result = await pool.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND owner_login = $${values.length} RETURNING ${columns}`, values);
    if (!result.rows[0]) { res.status(404).json({ error: 'Дело не найдено' }); return; }
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

tasksRouter.delete('/tasks/:id/', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND owner_login = $2',
      [req.params.id, config.author.login]);
    if (!result.rowCount) { res.status(404).json({ error: 'Дело не найдено' }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});

const handleDatabaseError: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('Task database operation failed:', error);
  res.status(503).json({ error: 'База данных временно недоступна' });
};
tasksRouter.use(handleDatabaseError);
