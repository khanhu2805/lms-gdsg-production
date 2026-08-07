# LMS GDSG

Hệ thống quản lý học tập tự lưu trữ dành cho Công ty Giáo dục Sài Gòn. Dự án
được xây mới bằng Next.js, TypeScript strict, PostgreSQL 17, Prisma, Better
Auth, worker FFmpeg và Nginx.

> Logo trong `public/brand/logo.svg` là wordmark tạm thời, trung tính. Hãy thay
> bằng logo chính thức trước khi nghiệm thu thương hiệu.

## Phạm vi đã triển khai

- Sáu vai trò: `ADMIN`, `MANAGER`, `TEACHER`, `TEACHING_ASSISTANT`, `STUDENT`,
  `PARENT`.
- Google OAuth duy nhất; không có đăng ký công khai; chỉ tài khoản đã tạo sẵn
  và đang hoạt động mới đăng nhập được.
- Tài khoản, hồ sơ, liên kết phụ huynh, lớp, sức chứa, thành viên và buổi học.
- Content chung theo buổi cho lesson, video, tài liệu, assignment và quiz.
- Quy trình trợ giảng gửi duyệt, giáo viên duyệt, xuất bản, khóa bản published,
  yêu cầu mở lại và tạo phiên bản.
- Bài tập/quiz có autosave, số lượt làm, chấm tự động phần khách quan, chấm thủ
  công và công bố kết quả. Quiz dùng thời gian máy chủ.
- Điểm danh từ nút vào lớp, phân biệt đúng giờ/đi trễ và worker chốt vắng.
- Upload được kiểm tra MIME/magic bytes/checksum; file nằm ngoài `public`;
  video lớn được ghi streaming xuống đĩa để không giữ toàn bộ tệp trong RAM.
- Video qua FFmpeg, HLS, thumbnail, kiểm quyền từng manifest/segment, giới hạn
  phiên xem, watermark metadata và progress.
- Report CSV và job nền có `FOR UPDATE SKIP LOCKED`, retry giới hạn, stale-lock
  recovery.
- Audit log append-only và lịch sử thay đổi điểm danh ở tầng cơ sở dữ liệu.
- Giao diện responsive từ mobile, menu riêng theo vai trò, không có module
  Notification. Khu vực quản trị có danh sách, tìm kiếm, tạo, xem chi tiết,
  chỉnh sửa và thao tác vòng đời cho tài khoản, môn học, lớp, buổi học và nội
  dung; đồng thời có màn hình điểm danh, chấm bài/quiz, báo cáo, job, audit và
  cài đặt.
- Docker Compose gồm PostgreSQL 17, migrate, app, worker và Nginx.

## Bắt đầu nhanh bằng Docker

Yêu cầu: Docker Engine 27+ và Docker Compose v2.

```bash
cp .env.example .env
openssl rand -base64 48
openssl rand -hex 32
openssl rand -base64 32
```

Điền vào `.env` tối thiểu:

- `POSTGRES_PASSWORD`
- `BETTER_AUTH_SECRET` (chuỗi ngẫu nhiên ít nhất 32 ký tự)
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `OAUTH_TOKEN_ENCRYPTION_KEY` (đúng 64 ký tự hex)
- `SEED_ADMIN_EMAIL` là email Google thật của admin đầu tiên
- URL public ở `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`,
  `BETTER_AUTH_TRUSTED_ORIGINS`

Khởi động:

```bash
docker compose up -d --build
docker compose ps
docker compose run --rm migrate npm run db:seed
```

Truy cập `http://localhost` (hoặc URL đã cấu hình). `migrate` chạy và thoát
trước khi app/worker khởi động. Seed an toàn theo kiểu upsert và production chỉ
tạo/cập nhật admin đã khai báo.

## Phát triển cục bộ

Yêu cầu: Node.js 22.12+ (khuyến nghị Node 24), npm 11, PostgreSQL 17, FFmpeg và
ffprobe.

```bash
npm ci
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Để có dữ liệu minh họa chỉ ở development:

```dotenv
NODE_ENV=development
SEED_DEMO=true
```

Sau đó chạy lại `npm run db:seed`. Không dùng các email demo khi triển khai
thật.

## Kiểm tra chất lượng

```bash
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run test:e2e
k6 run tests/load/api-smoke.js
```

Integration test PostgreSQL chỉ chạy khi có:

```bash
TEST_DATABASE_URL=postgresql://... npm run test:integration
```

K6 mặc định dùng `http://localhost`; đổi bằng `BASE_URL=https://lms.example.vn`.

## Cấu trúc chính

```text
src/
  app/                 UI, health endpoints và API v1
  components/          design system, auth và app shell
  config/              env, vai trò, trạng thái, navigation
  lib/                 auth, authorization, database, storage, security
  modules/             nghiệp vụ theo bounded context
  worker/              job claim, FFmpeg, report, attendance
prisma/
  schema.prisma
  migrations/
  seed.ts
deploy/nginx/          reverse proxy và protected file serving
docs/                  kiến trúc, quyền, API, triển khai, vận hành
scripts/               backup/restore cho Linux/macOS và Windows
tests/                 unit, integration, E2E, k6
```

## Tài liệu

- [Kiến trúc và mô hình dữ liệu](docs/architecture.md)
- [Ma trận quyền](docs/permissions.md)
- [API v1](docs/api.md)
- [Hướng dẫn quản trị](docs/admin-guide.md)
- [Triển khai và Google OAuth](docs/deployment.md)
- [Backup và restore](docs/backup-restore.md)
- [Bảo mật và vận hành](docs/security-operations.md)
- [Trạng thái kiểm chứng](docs/verification.md)

## Lưu ý vận hành

- Không public hoặc mount trực tiếp thư mục `/data/lms` ra web.
- Đặt TLS ở load balancer/reverse proxy phía trước Nginx và chỉ tin
  `X-Forwarded-*` từ proxy đó.
- Không chạy nhiều worker xử lý video hơn tài nguyên CPU/RAM cho phép; bắt đầu
  với 1–2 worker.
- Backup cả PostgreSQL và volume `protected-data`; kiểm thử restore định kỳ.
- Thay wordmark tạm bằng logo chính thức và kiểm tra quyền sử dụng tài sản.

Giấy phép sử dụng nội bộ; bổ sung tệp `LICENSE` theo quyết định của chủ sở hữu
trước khi phân phối ra ngoài tổ chức.
