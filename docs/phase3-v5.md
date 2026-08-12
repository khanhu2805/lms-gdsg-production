# Phase 3 v5 — Dialog chuẩn và authenticated E2E

## Thay đổi

- Thay toàn bộ `window.prompt()` trong admin editors bằng `ReasonDialog`.
- Thêm `ConfirmDialog` và `ActionDialogProvider` dùng chung.
- Giữ nguyên API/service và các business rule.
- Thêm `auth.test.ts` dùng Better Auth `testUtils()` cho test runner.
- Thêm Playwright E2E tạo session/cookie thật cho đủ 6 vai trò.
- Role E2E chỉ chạy khi có `E2E_DATABASE_URL`.

## Kiểm tra

```bash
npm run check
```

## Chạy E2E đủ 6 vai trò

Dùng một PostgreSQL riêng cho E2E.

```powershell
$env:E2E_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/lms_gdsg_e2e?schema=public"
$env:DATABASE_URL=$env:E2E_DATABASE_URL
npm run db:deploy
npm run test:e2e
```

Không dùng production database cho E2E.

## Phase tiếp theo

Class/Session form sẽ được chuyển sang React Hook Form + Zod sau khi v5 qua
pipeline, để tách thay đổi UX khỏi thay đổi form state/validation.
