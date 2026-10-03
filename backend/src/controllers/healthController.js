import env from '../config/env.js';
import { checkDatabaseHealth } from '../config/database.js';
import { checkRedisHealth } from '../config/redis.js';
import { checkMeiliHealth } from '../config/meilisearch.js';
import { queueService } from '../services/queueService.js';
import { QUEUE_NAMES } from '../config/queues.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const checkDependencies = async () => {
  const checks = await Promise.all([
    checkDatabaseHealth().catch((error) => ({ status: 'unhealthy', error: error.message })),
    checkRedisHealth().catch((error) => ({ status: 'unhealthy', error: error.message })),
    checkMeiliHealth().catch((error) => ({ status: 'unhealthy', error: error.message })),
  ]);

  return {
    database: checks[0],
    redis: checks[1],
    meilisearch: checks[2],
  };
};

export const getLiveness = asyncHandler(async (req, res) => {
  return ApiResponse.success(
    res,
    { service: 'ThePurple API', status: 'alive', uptimeSeconds: Math.floor(process.uptime()) },
    'ThePurple API process is alive'
  );
});

export const getReadiness = asyncHandler(async (req, res) => {
  const dependencies = await checkDependencies();
  const ready = Object.values(dependencies).every(({ status }) => status === 'healthy');
  const payload = {
    service: 'ThePurple API',
    status: ready ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    dependencies: Object.fromEntries(
      Object.entries(dependencies).map(([name, check]) => [name, { status: check.status }])
    ),
  };

  return ApiResponse.success(
    res,
    payload,
    ready ? 'ThePurple API is ready' : 'ThePurple API dependencies are not ready',
    ready ? 200 : 503
  );
});

export const getHealth = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const dependencies = await checkDependencies();
  const dbHealth = dependencies.database;
  const redisHealth = dependencies.redis;
  const meiliHealth = dependencies.meilisearch;

  let queueHealth = { status: 'idle' };
  if (redisHealth.status === 'healthy') {
    try {
      const metrics = await queueService.getQueueMetrics(QUEUE_NAMES.TEST_QUEUE);
      queueHealth = {
        status: 'healthy',
        testQueueCounts: metrics,
      };
    } catch (err) {
      queueHealth = { status: 'unhealthy', error: err.message };
    }
  } else {
    queueHealth = { status: 'degraded', reason: 'Redis unavailable' };
  }

  // Determine overall status
  const isHealthy =
    dbHealth.status === 'healthy' &&
    redisHealth.status === 'healthy' &&
    meiliHealth.status === 'healthy';

  const isDegraded =
    dbHealth.status === 'healthy' ||
    redisHealth.status === 'healthy' ||
    meiliHealth.status === 'healthy';

  const overallStatus = isHealthy ? 'healthy' : isDegraded ? 'degraded' : 'unhealthy';

  const fullDependencies = {
    database: dbHealth,
    redis: redisHealth,
    bullmq: queueHealth,
    meilisearch: meiliHealth,
  };
  const responseData = {
    service: 'ThePurple API',
    status: overallStatus,
    version: '1.0.0',
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    totalResponseTimeMs: Date.now() - startTime,
    dependencies: env.isProduction
      ? Object.fromEntries(
          Object.entries(fullDependencies).map(([name, check]) => [name, { status: check.status }])
        )
      : fullDependencies,
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
  return ApiResponse.success(res, responseData, `ThePurple API is ${overallStatus}`, httpStatus);
});

export default { getHealth };
