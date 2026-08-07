# API v1

Base path: `/api/v1`. Tất cả endpoint nghiệp vụ yêu cầu Better Auth session
cookie. Response JSON dùng envelope:

```json
{
  "success": true,
  "data": {}
}
```

Lỗi:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Bạn không có quyền thực hiện thao tác này."
  }
}
```

Mã lỗi chuẩn: `BAD_REQUEST`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `VALIDATION_ERROR`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## Endpoint

| Method             | Path                                     | Mô tả                                          |
| ------------------ | ---------------------------------------- | ---------------------------------------------- |
| GET                | `/health`                                | Liveness API                                   |
| GET, POST          | `/users`                                 | Danh sách/tạo tài khoản                        |
| GET, PATCH         | `/users/:userId`                         | Chi tiết, cập nhật, role, khóa/xóa mềm/restore |
| GET, POST          | `/users/:userId/children`                | Danh sách/liên kết phụ huynh-học sinh          |
| DELETE             | `/users/:userId/children/:studentId`     | Gỡ liên kết phụ huynh-học sinh                 |
| GET, POST          | `/subjects`                              | Danh sách/tạo môn học                          |
| GET, PATCH, DELETE | `/subjects/:subjectId`                   | Chi tiết, sửa, ngừng dùng môn học              |
| GET, POST          | `/classes`                               | Danh sách theo scope/tạo lớp                   |
| GET, PATCH         | `/classes/:classId`                      | Chi tiết/cập nhật optimistic lock              |
| GET, POST          | `/classes/:classId/staff`                | Danh sách/phân giáo viên hoặc trợ giảng        |
| DELETE             | `/classes/:classId/staff/:userId`        | Gỡ giáo viên/trợ giảng                         |
| POST               | `/classes/:classId/students`             | Thêm học sinh có kiểm capacity                 |
| DELETE             | `/classes/:classId/students/:studentId`  | Rời lớp, lưu lịch sử thành viên                |
| POST               | `/classes/transfers`                     | Chuyển lớp atomically                          |
| GET, POST          | `/sessions`                              | Danh sách theo lớp/tạo buổi                    |
| GET, PATCH         | `/sessions/:sessionId`                   | Chi tiết, sửa, mở/đóng điểm danh hoặc hủy      |
| GET, PATCH         | `/sessions/:sessionId/attendance`        | Xem/chấm điểm danh                             |
| POST               | `/student/sessions/:sessionId/join`      | Ghi attendance và nhận meeting URL             |
| GET, POST          | `/contents`                              | Danh sách metadata/tạo content                 |
| GET, PATCH         | `/contents/:contentId`                   | Chi tiết/sửa với optimistic lock               |
| POST               | `/contents/:contentId/workflow`          | Review/publish/reopen/hide/archive             |
| POST               | `/assets`                                | Upload multipart hoặc stream video             |
| GET                | `/assets/:assetId/download`              | Tải file qua X-Accel-Redirect                  |
| GET, POST          | `/videos/:recordingId/authorize`         | Tạo phiên xem/cấp manifest hoặc file bảo vệ    |
| GET                | `/videos/:recordingId/:segment`          | Cấp HLS segment sau kiểm quyền                 |
| POST               | `/videos/:recordingId/progress`          | Cập nhật tiến độ xem                           |
| GET                | `/assignments/:assignmentId`             | Payload an toàn cho student                    |
| POST               | `/assignments/:assignmentId/submissions` | Autosave hoặc nộp bài                          |
| PATCH              | `/submissions/:submissionId/grade`       | Đề xuất/chấm/công bố/trả bài                   |
| POST               | `/quizzes/:quizId/attempts`              | Bắt đầu attempt theo giờ server                |
| GET, PATCH, POST   | `/quiz-attempts/:attemptId`              | Đọc/autosave/nộp quiz                          |
| PATCH              | `/quiz-attempts/:attemptId/grade`        | Đề xuất/chấm/công bố kết quả quiz              |
| GET, POST          | `/reports`                               | Danh sách/yêu cầu report                       |
| GET                | `/reports/:reportId`                     | Chi tiết và tệp kết quả report                 |
| GET                | `/jobs`                                  | Theo dõi job                                   |
| GET                | `/jobs/:jobId`                           | Chi tiết job và kết quả/lỗi                    |
| POST               | `/jobs/:jobId/retry`                     | Retry job failed với lý do                     |
| GET                | `/audit`                                 | Tra cứu audit log                              |
| GET                | `/audit/:auditId`                        | Chi tiết old/new value của audit               |
| GET, POST          | `/settings`                              | Danh sách/tạo cài đặt hệ thống                 |
| GET, PATCH         | `/settings/:key`                         | Chi tiết/cập nhật cài đặt hệ thống             |

## Upload

Tài liệu, ảnh, bài nộp và video nhỏ dùng `multipart/form-data`:

- `category`: `RECORDING`, `DOCUMENT`, `SUBMISSION` hoặc `IMAGE`.
- `file`: nội dung tệp.

Không tin filename, extension hoặc MIME phía client. Server giới hạn kích thước,
đọc magic bytes, tạo UUID filename, checksum SHA-256 và lưu ngoài web root.
Student chỉ upload category `SUBMISSION`.

Video lớn nên gửi body trực tiếp để server ghi streaming xuống đĩa, không giữ
toàn bộ video trong RAM:

```bash
curl -X POST https://lms.example.vn/api/v1/assets \
  -H "Content-Type: video/mp4" \
  -H "X-File-Name: bai-giang-01.mp4" \
  -H "Origin: https://lms.example.vn" \
  -b cookies.txt \
  --data-binary @bai-giang-01.mp4
```

Chế độ này luôn tạo asset `RECORDING`, chỉ dành cho Admin, Manager, Teacher và
Teaching Assistant. Cả luồng streaming vẫn kiểm dung lượng, magic bytes, MIME và
checksum. Client production phải gửi cookie phiên cùng Origin hợp lệ.

## Video

`POST /videos/:recordingId/authorize` tạo phiên xem và trả `streamUrl`,
`viewSessionId`, MIME cùng dữ liệu watermark. `GET` trên `streamUrl` trả manifest
HLS đã gắn session; nếu bản HLS chưa có thì trả `204` để Nginx thực hiện internal
redirect file gốc. Response kèm:

- `X-Video-View-Session`: ID phiên xem.
- `X-Watermark-Data`: JSON watermark ở dạng base64url.

Client phải overlay watermark động trên player và gửi `viewSessionId` khi cập
nhật progress. Mỗi HLS segment tái kiểm tra session và quyền lớp.

## Chống CSRF và cache

- State-changing API từ browser phải có `Origin` khớp origin hiện tại.
- Better Auth kiểm CSRF/origin cho auth routes.
- Dữ liệu/file riêng tư dùng `private, no-store` hoặc cache ngắn cho segment.
- Nginx rate-limit API theo IP; Better Auth dùng rate-limit lưu trong database.
