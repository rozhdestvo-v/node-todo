import { app } from './app.js';
import { config } from './config.js';

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Приложение запущено: http://localhost:${config.port}`);
});

server.on('error', (error) => {
  console.error('Не удалось запустить сервер:', error);
  process.exit(1);
});