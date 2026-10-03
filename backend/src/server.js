import env from './config/env.js';
import logger from './config/logger.js';
import createApp from './app.js';
import sequelize from './config/database.js';
import { checkDatabaseHealth } from './config/database.js';
import { checkRedisHealth } from './config/redis.js';
import { checkMeiliHealth } from './config/meilisearch.js';
import { workerService } from './services/workerService.js';
import { queueService } from './services/queueService.js';
import { closeRedis } from './config/redis.js';
import { shiprocketCronService } from './services/shiprocketCronService.js';
import bootstrapSuperAdmin from './seeders/bootstrapAdmin.js';
import './models/index.js'; // Register models & associations

const app = createApp();

const startServer = async () => {
  logger.info(`Starting ThePurple API Server in [${env.NODE_ENV}] mode...`);

  // Probe infrastructure dependencies asynchronously
  const [db, redis, meili] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkMeiliHealth(),
  ]);

  logger.info(`Database status: ${db.status} (${db.dialect || 'n/a'})`);
  logger.info(`Redis status: ${redis.status}`);
  logger.info(`Meilisearch status: ${meili.status}`);

  if (db.status !== 'healthy') {
    throw new Error('PostgreSQL is unavailable; refusing to start the API.');
  }

  await bootstrapSuperAdmin();

  // Initialize background workers if Redis is ready
  if (redis.status === 'healthy') {
    workerService.initWorkers();
  } else {
    logger.warn('Redis is offline or unreachable; BullMQ background workers paused.');
  }

  // Initialize Shiprocket tracking periodic cron sync service
  try {
    shiprocketCronService.startCronJob();
  } catch (cronErr) {
    logger.warn(`Could not initialize Shiprocket background sync cron: ${cronErr.message}`);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`ThePurple API Server running at http://localhost:${env.PORT}`);
    logger.info(`Health check available at http://localhost:${env.PORT}/api/v1/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed.');

      try {
        shiprocketCronService.stopCronJob();
      } catch (e) {
        logger.warn(`Error stopping Shiprocket cron: ${e.message}`);
      }

      try {
        await workerService.closeAll();
        logger.info('BullMQ workers closed.');
      } catch (e) {
        logger.warn(`Error closing workers: ${e.message}`);
      }

      try {
        await queueService.closeAll();
        logger.info('BullMQ queues closed.');
      } catch (e) {
        logger.warn(`Error closing queues: ${e.message}`);
      }

      try {
        await closeRedis();
        logger.info('Redis client closed.');
      } catch (e) {
        logger.warn(`Error closing Redis client: ${e.message}`);
      }

      try {
        await sequelize.close();
        logger.info('Database connection closed.');
      } catch (e) {
        logger.warn(`Error closing database: ${e.message}`);
      }

      process.exit(0);
    });

    // Force shutdown after 10s if dangling connections exist
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error(`Failed to start server: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

// ThePurple Backend API Server
