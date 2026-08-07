#!/usr/bin/env bash
set -euo pipefail

backup_root="${BACKUP_ROOT:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_set="${backup_root}/${timestamp}"
postgres_user="${POSTGRES_USER:-lms}"
postgres_db="${POSTGRES_DB:-lms_gdsg}"

mkdir -p "${backup_set}"

docker compose exec -T db pg_dump \
  --username="${postgres_user}" \
  --dbname="${postgres_db}" \
  --format=custom \
  --no-owner \
  --no-privileges > "${backup_set}/database.dump"

docker run --rm \
  --volume lms-gdsg_protected-data:/source:ro \
  --volume "$(cd "${backup_set}" && pwd):/backup" \
  alpine:3.22 \
  tar -C /source -czf /backup/protected-data.tar.gz .

(
  cd "${backup_set}"
  sha256sum database.dump protected-data.tar.gz > SHA256SUMS
)

echo "Backup completed: ${backup_set}"
