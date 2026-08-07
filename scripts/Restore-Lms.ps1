param(
  [Parameter(Mandatory = $true)]
  [string]$BackupSet,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
if (-not $Force) {
  throw "Restore replaces current data. Re-run with -Force after verifying the target."
}
if (-not (Test-Path $BackupSet -PathType Container)) {
  throw "Backup directory does not exist: $BackupSet"
}

$postgresUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "lms" }
$postgresDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "lms_gdsg" }
$databaseDump = Join-Path $BackupSet "database.dump"
$archive = Join-Path $BackupSet "protected-data.tar.gz"
if (-not (Test-Path $databaseDump) -or -not (Test-Path $archive)) {
  throw "Backup set is incomplete."
}

docker compose stop app worker nginx
docker compose exec -T db dropdb --username=$postgresUser --if-exists $postgresDb
docker compose exec -T db createdb --username=$postgresUser $postgresDb
cmd /c "docker compose exec -T db pg_restore --username=$postgresUser --dbname=$postgresDb --no-owner --no-privileges < `"$databaseDump`""
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed" }

$absoluteBackupSet = (Resolve-Path $BackupSet).Path
docker run --rm `
  --volume "lms-gdsg_protected-data:/target" `
  --volume "${absoluteBackupSet}:/backup:ro" `
  alpine:3.22 sh -c "find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -C /target -xzf /backup/protected-data.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "Protected volume restore failed" }

docker compose up -d app worker nginx
Write-Host "Restore completed from: $BackupSet"
