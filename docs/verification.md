# Trạng thái kiểm chứng

Tệp này phân biệt rõ phần đã kiểm chứng trong môi trường tạo source và phần cần
chạy ở hạ tầng có Docker/PostgreSQL/browser.

## Đã chạy

- `prisma format`
- `prisma validate`
- `prisma generate`
- TypeScript strict typecheck
- ESLint
- 35 unit test nghiệp vụ (gồm validation CRUD quản trị và upload streaming)
- Coverage gate cho các policy thuần
- Next.js production build
- Playwright request smoke test trên cấu hình desktop và mobile
- `npm audit --omit=dev`: 0 vulnerability sau khi khóa bản vá dependency bắc
  cầu

## Có test/config nhưng cần môi trường ngoài

- Migration trên PostgreSQL 17 sạch:
  `TEST_DATABASE_URL=... npm run test:integration`.
- Seed trên database thật.
- Docker Compose smoke test (môi trường tạo source không có Docker daemon).
- Playwright giao diện trên Chromium/mobile; image browser chưa có trong môi
  trường tạo source. Flow Google OAuth cần tài khoản staging và storage state
  do tổ chức cung cấp.
- FFmpeg end-to-end với video mẫu trên worker và protected volume.
- K6 tới 300 VU trên staging.
- Backup/restore drill.

Không nên coi việc “có script” là đã đạt benchmark hay đã kiểm chứng hạ tầng.
Chạy checklist trên staging trước khi nghiệm thu production.

## Hạn chế còn lại

- Chưa có logo chính thức trong tệp đầu vào; `public/brand/logo.svg` là wordmark
  tạm và phải được thay trước nghiệm thu thương hiệu.
- Giao diện quản trị đã có CRUD và màn hình chi tiết cho các tài nguyên chính,
  nhưng chưa chạy UAT có xác thực Google trên dữ liệu staging của đơn vị.
- Upload video hỗ trợ streaming nhưng chưa hỗ trợ resume sau khi mất kết nối.
- Chưa xác nhận benchmark 300 VU, Docker smoke, migration/seed sạch, FFmpeg mẫu
  và backup/restore drill trong chính môi trường tạo source.
