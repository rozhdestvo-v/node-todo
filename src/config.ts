import 'dotenv/config';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Не задана переменная окружения: ${name}`);
  }

  return value;
}

const port = Number(process.env.PORT ?? '3000');

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT должен быть целым числом от 1 до 65535');
}

const apiToken = requiredEnv('API_TOKEN');

if (apiToken === 'replace_with_random_token') {
  throw new Error('Замени API_TOKEN в .env на случайный токен');
}

export const config = {
  port,
  apiToken,
  author: {
    login: requiredEnv('AUTHOR_LOGIN'),
    fullName: requiredEnv('AUTHOR_FULL_NAME')
  }
};