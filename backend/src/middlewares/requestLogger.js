import morgan from 'morgan';
import logger from '../config/logger.js';
import env from '../config/env.js';

// Pipe Morgan output to Winston
const stream = {
  write: (message) => logger.info(message.trim()),
};

morgan.token('safe-url', (req) => {
  try {
    return new URL(req.originalUrl, 'http://localhost').pathname;
  } catch {
    return '[invalid-url]';
  }
});

export const requestLogger = morgan(
  env.isProduction
    ? ':remote-addr :method :safe-url :status :res[content-length] :response-time ms'
    : ':method :safe-url :status :res[content-length] - :response-time ms',
  { stream }
);

export default requestLogger;
