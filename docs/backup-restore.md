# Backup và restore

Một bản backup hoàn chỉnh gồm:

1. PostgreSQL logical dump dạng custom.
2. Protected volume chứa video, HLS, tài liệu, submission, report.
3. Manifest SHA-256.
4. Bản sao secret/config tương ứng được lưu riêng trong secret manager.

## Linux/macOS/WSL

```bash
./scripts/backup.sh
BACKUP_SET=backups/20260730T120000Z ./scripts/restore.sh
```

Restore là thao tác phá hủy dữ liệu hiện tại, vì vậy cần xác nhận:

```bash
FORCE_RESTORE=yes BACKUP_SET=backups/20260730T120000Z ./scripts/restore.sh
```

## Windows PowerShell

```powershell
.\scripts\Backup-Lms.ps1
.\scripts\Restore-Lms.ps1 -BackupSet .\backups\20260730T120000Z -Force
```

## Chính sách đề xuất

- Database: mỗi ngày; protected files: snapshot/incremental mỗi ngày.
- Giữ 7 bản ngày, 4 bản tuần, 12 bản tháng.
- Mã hóa backup khi lưu ngoài máy chủ.
- Ít nhất một bản off-site, immutable.
- Chạy restore drill hàng quý trên môi trường cô lập.
- Không coi replication là backup.

## Kiểm tra sau restore

```bash
docker compose up -d db
docker compose run --rm migrate
docker compose up -d app worker nginx
curl -fsS http://localhost/readyz
docker compose exec -T db psql \
  -U "${POSTGRES_USER:-lms}" \
  -d "${POSTGRES_DB:-lms_gdsg}" \
  -c 'select count(*) from users;'
```

Kiểm tra thêm: đăng nhập admin, tải một tài liệu, phát một HLS video, xem job
queue và đối chiếu checksum của backup.
