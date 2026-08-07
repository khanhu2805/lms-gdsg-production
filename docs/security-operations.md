# Bảo mật và vận hành

## Kiểm soát đã có

- Google OAuth only; signup và implicit signup bị tắt.
- Session tạo mới bị từ chối nếu user không `ACTIVE`, bị khóa hoặc xóa.
- Mỗi request tải lại user từ database để vô hiệu hóa session ngay lập tức.
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` ở production.
- OAuth token mã hóa AES-256-GCM; log redact token/cookie/secret.
- Authorization theo role + class/resource ownership; Manager không tác động
  Admin.
- Zod validation, parameterized query qua Prisma, optimistic/row lock.
- Origin check cho API mutation, security headers và CSP.
- File magic-byte/MIME/size/path traversal check; UUID storage name.
- Protected file/video qua Nginx internal; không có public filesystem URL.
- Database rate limiting cho auth, Nginx rate/connection limit cho API.
- Audit append-only và attendance history.
- Container không chạy privileged, dùng non-root và `no-new-privileges`.

## Việc phải làm trước production

- Thay logo tạm bằng logo chính thức.
- Dùng TLS/HSTS tại edge.
- Chuyển secret vào secret manager; rotate secret mặc định.
- Chỉ mở 80/443; giới hạn SSH/VPN; không public DB/app/volume.
- Cấu hình log shipping, metric, alert và retention.
- Quét dependency/image và cập nhật bản vá định kỳ.
- Cấu hình antivirus/quarantine nếu chính sách cho phép upload từ bên ngoài.
- Đánh giá dung lượng video và tách object storage/CDN riêng nếu quy mô vượt một
  host; vẫn phải dùng signed/authenticated delivery.
- Chạy pentest IDOR cho từng role bằng tài khoản thật trong staging.

## Runbook job lỗi

1. Xem `/dashboard/jobs` hoặc `GET /api/v1/jobs?status=FAILED`.
2. Đọc `errorMessage`, log worker theo `jobId`.
3. Kiểm tra disk, quyền volume, FFmpeg và file nguồn.
4. Sửa nguyên nhân.
5. Retry qua API/UI với lý do; không sửa status bằng SQL.

Worker tự retry tối đa `maxAttempts` với exponential backoff và thu hồi lock cũ
sau 15 phút.

## Runbook user bị lộ tài khoản

1. Admin/Manager khóa user (Manager không khóa Admin).
2. Revoke toàn bộ session.
3. Thu hồi Google session/credential theo quy trình tổ chức.
4. Tra audit log theo user/time/IP.
5. Mở khóa sau xác minh; ghi rõ lý do.

## Dung lượng và hiệu năng

- Bắt đầu pool 20 connection/app, điều chỉnh theo tổng instance và
  `max_connections` PostgreSQL.
- Nginx giữ keepalive và offload file; app không đọc file vào RAM khi download.
- Video lớn có endpoint raw-body ghi streaming xuống đĩa; multipart vẫn dành
  cho file nhỏ. Khi cần resume qua mạng không ổn định hoặc tải đồng thời rất
  cao, bổ sung tus/S3 multipart ở tầng upload.
- K6 script là baseline; chạy trên staging có dữ liệu và hạ tầng tương đương,
  không chạy phá tải production.
