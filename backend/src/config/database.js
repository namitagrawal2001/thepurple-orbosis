import dns from 'node:dns';
import { Sequelize } from 'sequelize';
import env from './env.js';
import logger from './logger.js';

let sequelizeInstance;

const isLocalHost = (url = '') => url.includes('localhost') || url.includes('127.0.0.1');

export const createSequelizeInstance = () => {
  if (sequelizeInstance) return sequelizeInstance;

  const logging = env.DB_LOGGING ? (msg) => logger.debug(msg) : false;
  const databaseUrl = env.DATABASE_URL || '';
  const isRemote = Boolean(databaseUrl) && !isLocalHost(databaseUrl);
  const usesPooler = databaseUrl.includes('pooler.supabase.com');
  const isSupabaseDirect = databaseUrl.includes('.supabase.co') && !usesPooler;

  // Pooler hosts are IPv4. Direct db.*.supabase.co is IPv6-only — do not prefer IPv4 or DNS will stall.
  if (usesPooler) {
    dns.setDefaultResultOrder('ipv4first');
  }

  if (isSupabaseDirect) {
    logger.warn(
      'Using Supabase DIRECT database host (IPv6). For faster local APIs, paste the Session pooler URI from Supabase → Database → Connect.'
    );
  }

  const poolConfig = isRemote
    ? {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 5000,
        evict: 2000,
      }
    : {
        max: 10,
        min: 1,
        acquire: 10000,
        idle: 10000,
        evict: 5000,
      };

  const dialectOptions = {
    connectTimeout: isRemote ? 10000 : 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    ...(isRemote
      ? {
          ssl: {
            require: true,
          },
        }
      : {}),
  };

  if (databaseUrl.startsWith('postgres')) {
    sequelizeInstance = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging,
      benchmark: false,
      pool: poolConfig,
      dialectOptions,
    });
  } else {
    sequelizeInstance = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
      host: env.DB_HOST,
      port: env.DB_PORT,
      dialect: env.DB_DIALECT || 'postgres',
      logging,
      benchmark: false,
      pool: poolConfig,
      dialectOptions,
    });
  }

  if (isRemote) {
    setInterval(async () => {
      try {
        if (sequelizeInstance) {
          await sequelizeInstance.query('SELECT 1');
        }
      } catch {
        // keep-alive
      }
    }, 20000).unref();
  }

  return sequelizeInstance;
};

export const sequelize = createSequelizeInstance();

export const checkDatabaseHealth = async () => {
  try {
    const startTime = Date.now();
    await sequelize.authenticate();
    const latency = Date.now() - startTime;
    return {
      status: 'healthy',
      dialect: sequelize.getDialect(),
      database: sequelize.config.database || env.DB_NAME,
      host: sequelize.config.host,
      latencyMs: latency,
    };
  } catch (error) {
    logger.warn(`Database connection check failed: ${error.message}`);
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
};

export default sequelize;
