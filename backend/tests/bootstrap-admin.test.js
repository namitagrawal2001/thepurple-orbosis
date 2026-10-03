import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test, { afterEach } from 'node:test';
import bcrypt from 'bcryptjs';
import { Admin } from '../src/models/index.js';
import env from '../src/config/env.js';
import { bootstrapSuperAdmin } from '../src/seeders/bootstrapAdmin.js';

const originalFindOne = Admin.findOne;
const originalCreate = Admin.create;
const originalEmail = env.ADMIN_INITIAL_EMAIL;
const originalPassword = env.ADMIN_INITIAL_PASSWORD;

afterEach(() => {
  Admin.findOne = originalFindOne;
  Admin.create = originalCreate;
  env.ADMIN_INITIAL_EMAIL = originalEmail;
  env.ADMIN_INITIAL_PASSWORD = originalPassword;
});

test('creates the initial Super Admin with a forced password change', async () => {
  env.ADMIN_INITIAL_EMAIL = 'owner@example.com';
  env.ADMIN_INITIAL_PASSWORD = 'a-strong-initial-password';
  Admin.findOne = async () => null;
  Admin.create = async (values) => values;

  const admin = await bootstrapSuperAdmin();

  assert.equal(admin.email, 'owner@example.com');
  assert.equal(admin.mustChangePassword, true);
  assert.equal(await bcrypt.compare(env.ADMIN_INITIAL_PASSWORD, admin.passwordHash), true);
});

test('does not reset credentials on an existing Super Admin', async () => {
  env.ADMIN_INITIAL_EMAIL = 'owner@example.com';
  env.ADMIN_INITIAL_PASSWORD = 'a-different-password';
  const existingPasswordHash = await bcrypt.hash('existing-password', 4);
  const existingAdmin = {
    email: 'owner@example.com',
    passwordHash: existingPasswordHash,
    mustChangePassword: false,
    update: async () => assert.fail('Existing credentials must not be updated'),
  };
  Admin.findOne = async () => existingAdmin;

  const admin = await bootstrapSuperAdmin();

  assert.equal(admin, existingAdmin);
  assert.equal(admin.passwordHash, existingPasswordHash);
  assert.equal(admin.mustChangePassword, false);
});

test('requires a password before creating the initial Super Admin', async () => {
  env.ADMIN_INITIAL_EMAIL = 'owner@example.com';
  env.ADMIN_INITIAL_PASSWORD = '';
  Admin.findOne = async () => null;

  await assert.rejects(bootstrapSuperAdmin(), (error) => {
    assert.equal(error.code, 'ADMIN_INITIAL_PASSWORD_REQUIRED');
    assert.match(
      error.message,
      /ADMIN_INITIAL_PASSWORD is required to create the initial Super Admin account/
    );
    return true;
  });
});

test('forces legacy default-password accounts to change their password', async () => {
  env.ADMIN_INITIAL_EMAIL = 'owner@example.com';
  const legacyAdmin = {
    email: 'owner@example.com',
    passwordHash: await bcrypt.hash('123456', 4),
    mustChangePassword: false,
    update: async (values) => Object.assign(legacyAdmin, values),
  };
  Admin.findOne = async () => legacyAdmin;

  const admin = await bootstrapSuperAdmin();

  assert.equal(admin.mustChangePassword, true);
});

test('accepts strong production secrets', () => {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', 'import "./src/config/env.js"'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://thepurple.in',
        DB_PASSWORD: 'ci_db_password_123456789012345678',
        JWT_SECRET: 'ci_jwt_secret_123456789012345678901234',
        MEILISEARCH_MASTER_KEY: 'ci_meili_key_123456789012345678901234',
        REDIS_PASSWORD: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        ADMIN_INITIAL_EMAIL: 'owner@thepurple.in',
        ADMIN_INITIAL_PASSWORD: 'ci-initial-admin-password-123',
        SMTP_HOST: 'smtp.thepurple.test',
        SMTP_USER: 'ci@thepurple.test',
        SMTP_PASSWORD: 'ci-smtp-password-123456',
      },
    }
  );

  assert.equal(result.status, 0, result.stderr);
});

test('does not require the one-time bootstrap password after configuration', () => {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', 'import "./src/config/env.js"'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://thepurple.in',
        DB_PASSWORD: 'ci_db_password_123456789012345678',
        JWT_SECRET: 'ci_jwt_secret_123456789012345678901234',
        MEILISEARCH_MASTER_KEY: 'ci_meili_key_123456789012345678901234',
        REDIS_PASSWORD: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        ADMIN_INITIAL_EMAIL: 'owner@thepurple.in',
        ADMIN_INITIAL_PASSWORD: '',
        SMTP_HOST: 'smtp.thepurple.test',
        SMTP_USER: 'ci@thepurple.test',
        SMTP_PASSWORD: 'ci-smtp-password-123456',
      },
    }
  );

  assert.equal(result.status, 0, result.stderr);
});

test('rejects missing production secrets', () => {
  const childEnv = { ...process.env, NODE_ENV: 'production' };
  for (const key of [
    'DB_PASSWORD',
    'DATABASE_URL',
    'FRONTEND_URL',
    'JWT_SECRET',
    'MEILISEARCH_MASTER_KEY',
    'REDIS_PASSWORD',
    'ADMIN_INITIAL_EMAIL',
    'ADMIN_INITIAL_PASSWORD',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASSWORD',
  ]) {
    delete childEnv[key];
  }

  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', 'import "./src/config/env.js"'],
    { cwd: process.cwd(), encoding: 'utf8', env: childEnv }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid production configuration/);
});
