import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { tasksRouter } from './tasks.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, '../public');
export const app = express();
app.disable('x-powered-by');
app.enable('strict routing');
app.get('/login/', (_req, res) => { res.type('text/plain').send(config.author.login); });

const api = express.Router({ strict: true });
api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
api.use(requireAuth);
api.use(express.json({ limit: '16kb' }));
api.get('/author/', (_req, res) => { res.json(config.author); });
api.use(tasksRouter);
api.use((_req, res) => { res.status(404).json({ error: 'Маршрут API не найден' }); });
app.use('/api', api);
app.use(express.static(publicDirectory));
app.use((_req, res) => { res.status(404).type('text/plain').send('Страница не найдена'); });

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: 'Некорректный JSON' }); return;
  }
  if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({ error: 'Слишком большой запрос' }); return;
  }
  console.error(error);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
};
app.use(handleError);
