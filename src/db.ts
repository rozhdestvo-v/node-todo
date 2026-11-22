import 'dotenv/config';

import { readFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error('Не задана переменная окружения: DATABASE_URL');
}

const sslEnabled = process.env.DB_SSL === 'true';
const caPath = process.env.DB_SSL_CA_PATH?.trim();

const url = new URL(connectionString);

for (const option of [
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey'
]) {
  if (url.searchParams.has(option)) {
    throw new Error(
      `Убери ${option} из DATABASE_URL: TLS настраивается через DB_SSL`
    );
  }
}

if (sslEnabled && !caPath) {
  throw new Error(
    'При DB_SSL=true необходимо задать DB_SSL_CA_PATH'
  );
}

if (
  !sslEnabled &&
  !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
) {
  throw new Error(
    'Подключение к удалённой БД без TLS запрещено. Задай DB_SSL=true'
  );
}

export const pool = new pg.Pool({
  connectionString,

  ssl: sslEnabled
    ? {
        ca: readFileSync(caPath!, 'utf8'),
        rejectUnauthorized: true
      }
    : false,

  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true
});

pool.on('error', (error) => {
  console.error('PostgreSQL idle client error:', error);
});