#!/usr/bin/env bash
set -euo pipefail

backup_set="${BACKUP_SET:-}"
postgres_user="${POSTGRES_USER:-lms}"
postgres_db="${POSTGRES_DB:-lms_gdsg}"

if [[ -z "${backup_set}" || ! -d "${backup_set}" ]]; then
  echo "Set BACKUP_SET to an existing backup directory." >&2
  exit 2
fi

if [[ "${FORCE_RESTORE:-no}" != "yes" ]]; then
  echo "Restore replaces the current database and protected files." >&2
  echo "Re-run with FORCE_RESTORE=yes after verifying the target." >&2
  exit 3
fi

(
  cd "${backup_set}"
  sha256sum --check SHA256SUMS
)

docker compose stop app worker nginx

docker compose exec -T db dropdb \
  --username="${postgres_user}" \
  --if-exists "${postgres_db}"
docker compose exec -T db createdb \
  --username="${postgres_user}" \
  "${postgres_db}"
docker compose exec -T db pg_restore \
  --username="${postgres_user}" \
  --dbname="${postgres_db}" \
  --no-owner \
  --no-privileges < "${backup_set}/database.dump"

docker run --rm \
  --volume lms-gdsg_protected-data:/target \
  --volume "$(cd "${backup_set}" && pwd):/backup:ro" \
  alpine:3.22 \
  sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /target -xzf /backup/protected-data.tar.gz'

docker compose up -d app worker nginx
echo "Restore completed from: ${backup_set}"
