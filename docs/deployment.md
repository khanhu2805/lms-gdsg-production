# Triển khai

## Chuẩn bị Google OAuth

1. Tạo OAuth 2.0 Client loại Web application trong Google Cloud Console.
2. Authorized JavaScript origins: URL public chính xác, ví dụ
   `https://lms.example.vn`.
3. Authorized redirect URI:
   `https://lms.example.vn/api/auth/callback/google`.
4. Điền `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` vào `.env`.
5. Pre-create admin bằng `SEED_ADMIN_EMAIL` đúng email Google. Hệ thống không
   tự tạo user mới khi callback.

Nếu domain/port/protocol khác nhau, cả ba biến `NEXT_PUBLIC_APP_URL`,
`BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` phải dùng origin public cuối
cùng. Không thêm dấu `/` cuối.

## Secret production

```bash
openssl rand -base64 48   # BETTER_AUTH_SECRET
openssl rand -base64 32   # NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
openssl rand -hex 32      # OAUTH_TOKEN_ENCRYPTION_KEY
openssl rand -base64 32   # POSTGRES_PASSWORD
```

Không commit `.env`. Sao lưu khóa mã hóa OAuth trong secret manager; mất khóa
sẽ không giải mã được token cũ (người dùng cần liên kết lại).

## Docker Compose

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f app worker nginx
docker compose run --rm migrate npm run db:seed
```

Thứ tự:

1. PostgreSQL healthy.
2. `migrate` chạy `prisma migrate deploy` và thoát thành công.
3. App/worker khởi động.
4. Nginx chỉ nhận traffic khi app ready.

Scale app cho 300 CCU sau khi đo tải:

```bash
docker compose up -d --scale app=3
```

Với Compose DNS, Nginx cần reload sau khi thay scale để resolve lại upstream.
Trong production lớn hơn, dùng orchestrator/load balancer có service discovery.
Không scale worker video tùy ý; giới hạn bằng CPU/RAM và
`MAX_CONCURRENT_VIDEO_JOBS`.

## TLS

`deploy/nginx/default.conf` lắng nghe HTTP 8080 trong container. Đặt TLS ở load
balancer, ingress hoặc reverse proxy phía trước. Proxy phải:

- chuyển đúng `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`;
- giới hạn nguồn truy cập tới Nginx;
- dùng HTTPS và HSTS ở biên;
- không expose trực tiếp port app 3000 hay PostgreSQL 5432.

## Windows / Docker Desktop

1. Bật WSL 2 backend và Linux containers.
2. Clone/giải nén dự án vào filesystem WSL để I/O nhanh hơn.
3. Tạo `.env` bằng PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose run --rm migrate npm run db:seed
```

Không đổi line ending của script shell nếu chạy trong WSL. Có script PowerShell
riêng cho backup/restore.

## Cập nhật phiên bản

```bash
./scripts/backup.sh
docker compose build
docker compose run --rm migrate
docker compose up -d
curl -fsS https://lms.example.vn/readyz
```

Migration phải forward-compatible với phiên bản app đang chạy nếu triển khai
rolling. Với thay đổi phá vỡ, dùng quy trình expand/migrate/contract.

## Health

- `/healthz`: liveness, không truy cập database.
- `/readyz`: readiness, chạy truy vấn database nhẹ.
- `/api/v1/health`: envelope API.

Alert khi readiness lỗi, job failed tăng, disk >80%, PostgreSQL connection cao,
worker không claim job hoặc backup không thành công.
