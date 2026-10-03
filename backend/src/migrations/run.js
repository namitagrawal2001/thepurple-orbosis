import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sequelize from '../config/database.js';
import logger from '../config/logger.js';
import '../models/index.js';

const migrationDirectory = path.dirname(fileURLToPath(import.meta.url));
const advisoryLockId = 84173921;

export const runMigrations = async () => {
  if (sequelize.getDialect() !== 'postgres') {
    throw new Error('The migration runner currently supports PostgreSQL only.');
  }

  const filenames = (await readdir(migrationDirectory))
    .filter((filename) => /^\d+-.+\.js$/.test(filename))
    .sort();

  await sequelize.transaction(async (transaction) => {
    await sequelize.query('SELECT pg_advisory_xact_lock(:lockId)', {
      replacements: { lockId: advisoryLockId },
      transaction,
    });
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "schema_migrations" (
        "name" VARCHAR(255) PRIMARY KEY,
        "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `, { transaction });

    const [appliedRows] = await sequelize.query(
      'SELECT "name" FROM "schema_migrations"',
      { transaction }
    );
    const applied = new Set(appliedRows.map(({ name }) => name));

    for (const filename of filenames) {
      if (applied.has(filename)) continue;

      const migration = await import(pathToFileURL(path.join(migrationDirectory, filename)));
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${filename} must export an up function.`);
      }

      logger.info(`Applying database migration ${filename}`);
      await migration.up({ sequelize, queryInterface: sequelize.getQueryInterface(), transaction });
      await sequelize.query(
        'INSERT INTO "schema_migrations" ("name") VALUES (:name)',
        { replacements: { name: filename }, transaction }
      );
    }
  });

  logger.info('Database migrations are up to date.');
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations()
    .catch((error) => {
      logger.error(`Database migration failed: ${error.message}`, { stack: error.stack });
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}
