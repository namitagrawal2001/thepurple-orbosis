import helmet from 'helmet';
import cors from 'cors';
import env from '../config/env.js';

export const configureSecurityHeaders = () => {
  return helmet({
    contentSecurityPolicy: env.isProduction ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
};

export const configureCors = () => {
  const allowedOrigins = [env.FRONTEND_URL];
  if (!env.isProduction) {
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.includes(origin) || !env.isProduction;

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked access from origin ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-session-id',
      'x-guest-id',
      'X-Session-Id',
      'X-Guest-Id',
      'Cache-Control',
      'Accept-Language',
    ],
  });
};
