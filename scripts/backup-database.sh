#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${1:-backups/thepurple-postgres-${timestamp}.dump}"

if [[ -e "$backup_path" ]]; then
  echo "Refusing to overwrite existing backup: $backup_path" >&2
  exit 1
fi

mkdir -p "$(dirname "$backup_path")"
trap 'rm -f "$backup_path"' ERR

docker compose exec -T postgres sh -ec \
  'exec pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  > "$backup_path"

if [[ ! -s "$backup_path" ]]; then
  echo "PostgreSQL backup is empty: $backup_path" >&2
  exit 1
fi

docker compose exec -T postgres pg_restore --list < "$backup_path" >/dev/null
echo "Backup created and verified: $backup_path"
