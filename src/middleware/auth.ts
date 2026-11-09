import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

import { config } from '../config.js';

export const requireAuth: RequestHandler = (req, res, next) => {
  const authorization = req.get('authorization');
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);

  if (!match) {
    res.status(401).json({
      error: 'Требуется корректный Bearer-токен'
    });
    return;
  }

  const actualToken = Buffer.from(match[1] ?? '', 'utf8');
  const expectedToken = Buffer.from(config.apiToken, 'utf8');

  const valid =
    actualToken.length === expectedToken.length &&
    timingSafeEqual(actualToken, expectedToken);

  if (!valid) {
    res.status(401).json({
      error: 'Неверный токен'
    });
    return;
  }

  next();
};