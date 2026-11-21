import pg from 'pg';

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error('Не задана переменная окружения: DATABASE_URL');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});
pool.on('error', (error) => console.error('PostgreSQL idle client error:', error));
