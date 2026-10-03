import Redis from 'ioredis';
import { readFileSync } from 'node:fs';
import env from './env.js';
import logger from './logger.js';

let redisClient = null;

const getRedisPassword = () => {
  if (env.REDIS_PASSWORD_FILE) {
    return readFileSync(env.REDIS_PASSWORD_FILE, 'utf8').trim();
  }
  return env.REDIS_PASSWORD;
};

export const getRedisOptions = () => {
  const password = getRedisPassword();
  if (env.REDIS_URL && (env.REDIS_URL.startsWith('redis://') || env.REDIS_URL.startsWith('rediss://'))) {
    const parsed = new URL(env.REDIS_URL);
    const isTls = parsed.protocol === 'rediss:';
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : password,
      tls: isTls ? {} : undefined,
      connectTimeout: 5000,
      commandTimeout: 5000,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop reconnecting after 3 attempts
        }
        return Math.min(times * 200, 1000);
      },
      reconnectOnError(err) {
        return err.message.includes('READONLY');
      },
      lazyConnect: true,
    };
  }

  return {
    host: env.REDIS_HOST || 'localhost',
    port: env.REDIS_PORT || 6379,
    password,
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop reconnecting after 3 attempts
      }
      return Math.min(times * 200, 1000);
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
    lazyConnect: true,
  };
};

export const getRedisClient = () => {
  if (!redisClient) {
    if (env.REDIS_URL && (env.REDIS_URL.startsWith('redis://') || env.REDIS_URL.startsWith('rediss://'))) {
      redisClient = new Redis(env.REDIS_URL, getRedisOptions());
    } else {
      const options = getRedisOptions();
      redisClient = new Redis(options);
    }

    redisClient.on('connect', () => {
      logger.info('Connected to Redis server');
    });

    redisClient.on('ready', () => {
      logger.info('Redis connection ready for commands');
    });

    redisClient.on('error', (err) => {
      logger.warn(`Redis connection error: ${err.message}`);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisClient;
};

export const checkRedisHealth = async () => {
  try {
    const client = getRedisClient();
    if (client.status !== 'ready' && client.status !== 'connecting' && client.status !== 'connect') {
      await client.connect();
    }
    const startTime = Date.now();
    const pong = await client.ping();
    const latency = Date.now() - startTime;
    return {
      status: pong === 'PONG' ? 'healthy' : 'degraded',
      latencyMs: latency,
      clientStatus: client.status,
    };
  } catch (error) {
    logger.warn(`Redis health check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
};

export const closeRedis = async () => {
  if (!redisClient || redisClient.status === 'end') return;
  if (redisClient.status === 'ready') {
    await redisClient.quit();
  } else {
    redisClient.disconnect();
  }
  redisClient = null;
};

export default getRedisClient;
