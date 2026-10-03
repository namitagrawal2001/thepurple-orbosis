# Production deployment

## Before deploying

1. Create the root `.env` from `.env.example`, set real values, then run `chmod 600 .env`. Never commit `.env`, backups, Docker Hub tokens, or provider credentials.
2. Generate unique database, Redis, Meilisearch, and JWT secrets. Example for password values:

   ```bash
   openssl rand -hex 32
   ```

3. Set `DB_ADMIN_*`, `DB_MIGRATION_*`, and runtime `DB_*` credentials to distinct values. Only the database and one-shot role-bootstrap service receive the database administrator credentials; the migration process and API use separate roles.
4. Create the Compose Redis secret file; it is mounted into Redis and the backend, not placed in container command-line arguments:

   ```bash
   install -d -m 700 secrets
   umask 077
   openssl rand -hex 32 > secrets/redis_password
   chmod 600 secrets/redis_password
   ```

5. Set `FRONTEND_URL` to the public HTTPS frontend origin, `NEXT_PUBLIC_API_URL` to the public HTTPS API URL ending in `/api/v1`, and `ADMIN_INITIAL_EMAIL` to the existing Super Admin email. A frontend image build fails without a valid public API URL.
6. Configure valid SMTP host/user/password values. Production refuses to start without SMTP because admin invitations and password resets must not fall back to local logging. Configure payment, R2, and Shiprocket values only when those integrations are enabled.
7. For an existing database volume, back it up before updating. Set `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` to the PostgreSQL administrator credentials that already exist in that volume. The `POSTGRES_USER`/`POSTGRES_PASSWORD` variables initialize only a new volume; changing them does not rotate or create credentials in an existing database.
8. Confirm the host firewall only exposes the HTTPS reverse proxy. Database and Meilisearch host ports bind to loopback; Redis has no host port. Terminate TLS at a reverse proxy and proxy frontend/API routes to ports 3000/5000.

Compose intentionally refuses to start production services if database, Meilisearch, JWT, admin email, frontend URL, Redis secret file, or SMTP configuration is missing or weak. The backend validates production secrets at startup. Docker Compose passes environment variables to containers; users with access to the Docker daemon can inspect container configuration, so protect Docker access and the `.env` file. For stronger isolation, inject credentials from a host or cloud secret manager.

Compose uses three networks: the frontend is on `public` and `app`, the API is on `public`, `app`, and `data`, and database/Redis/Meilisearch/bootstrap/migration services are only on the internal `data` network. The API needs outbound access for configured email, payment, storage, and shipping providers. Standalone Compose file secrets are read-only mounts, not an encrypted cloud secret store; protect the host directory and backups.

The role bootstrap is repeatable and transfers ownership of existing public tables/sequences owned by the configured DB administrator to the migration role. Tables owned by another role are not transferred automatically; a reviewed, staging-tested ownership migration is needed before the migration role can alter them. Review the SQL and run it against a staging copy first, especially for databases with non-application objects in `public`. The API role receives DML and sequence privileges, not schema/role administration.

The initial admin password is a one-time bootstrap value. Use a strong password of at least 12 characters, sign in, change it immediately, remove `ADMIN_INITIAL_PASSWORD` from `.env`, and restart the backend. The existing admin account is preserved on restarts; its password is never reset by bootstrap. Existing accounts still using the legacy `123456` password are required to change it. For this existing database set `ADMIN_INITIAL_EMAIL=superadmin@gmail.com`.

## Migrations

`docker compose up -d` pulls the selected backend image, waits for PostgreSQL, and runs the `migrate` one-shot service before starting the API. Migration records are stored in `schema_migrations`; a PostgreSQL advisory lock prevents concurrent app instances from applying the same migration simultaneously. Run one-off migrations with `docker compose run --rm migrate`.

The initial baseline migration uses `sequelize.sync({ alter: false })`: it creates absent tables for a fresh database, but does not alter existing tables. It now verifies that all model columns exist before the migration ledger is committed; a missing column aborts the transaction. Existing deployments should take and verify a backup and compare their schema before first adopting this migration ledger. Do not restore/drop/recreate a production database as part of adoption. The derived-pricing migration recalculates product discount percentages and variant MRPs once; review those fields in a staging copy before production rollout.

Add future changes as ordered files in `backend/src/migrations`, export an `up` function, and use the provided transaction for all schema/data changes. Prefer additive expand-and-contract changes: add nullable/backward-compatible fields, deploy code that supports both schemas, backfill separately, then remove old fields only in a later explicitly reviewed migration. No automatic migration rollback is provided because arbitrary data changes cannot be safely reversed.

## Backups and restore

Create a consistent custom-format PostgreSQL backup (file permissions are restricted and the archive is verified):

```bash
./scripts/backup-database.sh
# Or choose a protected destination:
./scripts/backup-database.sh /secure/backup/location/thepurple.dump
```

The script does not overwrite an existing file. Schedule it from the host (for example, install this in root's crontab after replacing the absolute paths):

```cron
15 2 * * * flock -n /run/lock/thepurple-backup.lock /absolute/path/to/thepurple/scripts/backup-database.sh >> /var/log/thepurple-backup.log 2>&1
```

Monitor the job's exit status and log, copy backups to encrypted off-host storage, define retention, and periodically test restore into a separate non-production database. For example, encrypt an already verified dump with `age` using an organization-managed recipient key before transferring it; do not store the decryption identity beside the backup. A backup left only on the database host does not protect against host loss.

For restore drills, create a disposable PostgreSQL database and restore the archive there without `--clean`; verify table counts and application reads, then remove only that explicitly disposable test database. Record the drill date/result and test recovery of any separately persisted Redis/Meilisearch data needed by your recovery objectives.

Restoring is destructive. First stop writes, verify a separate current backup, confirm the target database and restore file, and obtain an explicit operator approval. Then restore only to the confirmed target. Do not run `pg_restore --clean` against production without that approval.

## CI, scanning, and Docker Hub

In the GitHub repository, configure Actions secrets:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN` with push permission for both ThePurple repositories

Configure Actions variables:

- `NEXT_PUBLIC_API_URL`: public HTTPS API URL ending in `/api/v1`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`: public Razorpay key ID, if payments are enabled
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)

Firebase and Razorpay browser configuration is public client configuration, not a server secret; Firebase security rules and provider restrictions must still be configured. Do not put private provider keys in `NEXT_PUBLIC_*` variables. Private Razorpay, R2, SMTP, Shiprocket, and other credentials belong in the host secret environment only.

The workflow runs backend migration/integration tests, frontend lint, dependency review/audit, secret scanning, Docker image scans, and generates CycloneDX SBOM artifacts. GitHub Actions are pinned to immutable commit SHAs. It builds the images once, scans those exact local images, exports them as a short-lived workflow artifact, then publishes those same images only after successful checks; GitHub build provenance attests the exported image archive. Only successful runs on `master` or a `v*` release tag can publish. Docker Hub images receive branch/release, commit-SHA tags, and `latest` on the default branch. Configure GitHub's immutable-tag protection for release tags. Pull requests never receive Docker Hub credentials or publish images.

Run `npm test` in `backend/` for database-free unit/parser tests. `npm run test:integration` requires `NODE_ENV=test`, a loopback database named `thepurple_test_*`, and a matching `INTEGRATION_TEST_DATABASE` marker; it creates and modifies test records. The integration script aborts before loading application/database modules unless these guards pass. Still use disposable PostgreSQL, Redis, and Meilisearch services; never point it at a developer or production database.

Frontend lint runs the standalone ESLint core parser with JSX parsing and a small set of syntax/static correctness rules. It deliberately avoids `eslint-config-next`, whose current transitive dependency chain triggered high-severity audit findings. The production build also validates `NEXT_PUBLIC_API_URL` as a public HTTPS API endpoint before Next.js compiles it into the image.

## Deploy and rollback

Deploy the current default image:

```bash
docker compose pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:5000/api/v1/health/ready
```

Compose uses `pull_policy: always`. To pin a deployment or roll back application code, set `IMAGE_TAG` in `.env` to the same known-good `sha-<commit>` tag for both images, or set `BACKEND_IMAGE` and `FRONTEND_IMAGE` to explicit Docker Hub references using `@sha256:<digest>`. Then run `docker compose pull && docker compose up -d`. Keep a record of deployed digests and SBOM artifacts. A code-image rollback does not reverse database migrations; retain backward-compatible schemas or restore only under an approved recovery plan.

The Node 22 Debian base images are pinned to the multi-platform manifest digest present when these Dockerfiles were reviewed. Digest pinning prevents a tag moving unexpectedly but does not automatically receive security updates; periodically review Node 22 security releases, update the digest deliberately, rebuild, scan, and deploy.

Compose's PostgreSQL, Redis, and Meilisearch service images remain on explicit upstream version tags rather than digests so maintainers can apply vendor patch releases through controlled tag updates while retaining upstream multi-platform selection. These tags are not immutable; review them during maintenance, or replace them with vetted manifest digests if the deployment requires immutable infrastructure images.

## Health, logs, and monitoring

- `/api/v1/health/live` reports whether the API process is alive.
- `/api/v1/health/ready` returns HTTP 503 unless PostgreSQL, Redis, and Meilisearch are healthy. Use this for deployment and uptime checks.
- `/api/health` is the frontend process health endpoint.
- Check `docker compose ps` and `docker compose logs --since=15m backend frontend migrate`. Docker JSON logs rotate at 10 MB per file, five files per service; forward logs to a protected centralized system for retention and alerting.
- Configure an external uptime monitor for the public HTTPS site and API readiness route. Alert on repeated 5xx responses, unhealthy/restarting containers, failed migration jobs, failed backups, and low disk space. Review backups and restore drills routinely.
