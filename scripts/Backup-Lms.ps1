param(
  [string]$BackupRoot = ".\backups"
)

$ErrorActionPreference = "Stop"
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$backupSet = Join-Path $BackupRoot $timestamp
$postgresUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "lms" }
$postgresDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "lms_gdsg" }
New-Item -ItemType Directory -Force -Path $backupSet | Out-Null

$databaseDump = Join-Path $backupSet "database.dump"
cmd /c "docker compose exec -T db pg_dump --username=$postgresUser --dbname=$postgresDb --format=custom --no-owner --no-privileges > `"$databaseDump`""
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }

$absoluteBackupSet = (Resolve-Path $backupSet).Path
docker run --rm `
  --volume "lms-gdsg_protected-data:/source:ro" `
  --volume "${absoluteBackupSet}:/backup" `
  alpine:3.22 tar -C /source -czf /backup/protected-data.tar.gz .
if ($LASTEXITCODE -ne 0) { throw "Protected volume backup failed" }

$hashes = @(
  Get-FileHash -Algorithm SHA256 $databaseDump
  Get-FileHash -Algorithm SHA256 (Join-Path $backupSet "protected-data.tar.gz")
)
$hashes | ForEach-Object { "$($_.Hash.ToLower())  $([IO.Path]::GetFileName($_.Path))" } |
  Set-Content -Encoding ascii (Join-Path $backupSet "SHA256SUMS")

Write-Host "Backup completed: $backupSet"
