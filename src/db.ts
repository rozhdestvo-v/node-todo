import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error('Не задана переменная окружения: DATABASE_URL');
}

const sslEnabled = process.env.DB_SSL === 'true';
const caPath = process.env.DB_SSL_CA_PATH?.trim();
const caBase64 = process.env.DB_SSL_CA_BASE64?.trim();

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

if (sslEnabled && !caPath && !caBase64) {
  throw new Error(
    'При DB_SSL=true задай DB_SSL_CA_PATH или DB_SSL_CA_BASE64'
  );
}

if (
  !sslEnabled &&
  !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
) {
  throw new Error(
    'Подключение к удалённой БД без TLS запрещено'
  );
}

function loadCa(): string {
  if (caBase64) {
    const certificate = Buffer.from(caBase64, 'base64')
      .toString('utf8');

    if (!certificate.includes('-----BEGIN CERTIFICATE-----')) {
      throw new Error(
        'DB_SSL_CA_BASE64 не содержит PEM-сертификат'
      );
    }

    return certificate;
  }

  return readFileSync(caPath!, 'utf8');
}

export const pool = new pg.Pool({
  connectionString,

  ssl: sslEnabled
    ? {
        ca: loadCa(),
        rejectUnauthorized: true
      }
    : false,

  max: 3,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 5_000,
  keepAlive: true
});

if (process.env.VERCEL === '1') {
  attachDatabasePool(pool);
}

pool.on('error', (error) => {
  console.error('PostgreSQL idle client error:', error);
});