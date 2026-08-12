# Learner flow fixes

Bản vá này bổ sung luồng học sinh/phụ huynh mà source hiện tại còn thiếu:

- Student/Parent mở được chi tiết lớp nhưng không nhận roster/email học sinh.
- Chi tiết lớp hiển thị giáo viên và danh sách buổi học.
- Student có nút **Vào lớp** đúng cửa sổ thời gian, gọi internal join route để ghi attendance trước khi redirect.
- Chi tiết buổi học hiển thị toàn bộ Content đã `PUBLISHED`.
- Learner có trang xem Lesson, Material, Video, Assignment và Quiz.
- Assignment có autosave, upload file submission và submit.
- Quiz dùng attempt/timer server, autosave và auto-submit khi bộ đếm về 0; server vẫn là nguồn sự thật.
- Staff có nút mở meeting từ session detail.
- `assertClassAccess` bắt buộc lớp ACTIVE cho Student/Parent.
- Manual attendance chỉ nhận membership ACTIVE.
- Draft assignment trả answers để resume sau refresh.
- Bổ sung `.env.example` và cho phép commit file này.

## Kiểm tra sau khi áp dụng

Chạy:

```bash
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
```

Sau đó UAT bằng tài khoản thật cho ít nhất STUDENT và PARENT:

1. Student > Lớp học > Mở > chọn buổi.
2. Kiểm tra trước cửa sổ join không có link Meet trực tiếp.
3. Trong cửa sổ join nhấn **Vào lớp**, kiểm tra Attendance.
4. Mở Lesson/Material/Video.
5. Làm Assignment, refresh giữa chừng để kiểm tra resume/autosave.
6. Làm Quiz và kiểm tra server timer/submit.
7. Parent mở cùng lớp/buổi nhưng không thể join hoặc làm bài.

## Còn nên tiếp tục

Bản vá tập trung vào lỗi learner P0 và các lỗi authorization liên quan. Các hạng mục UX/scale lớn hơn như child switcher xuyên toàn hệ thống, dashboard riêng hoàn chỉnh cho 6 role, pagination server-side cho mọi bảng, thay toàn bộ window.prompt bằng ReasonDialog, chuyển toàn bộ form quản trị sang React Hook Form + Zod và bộ E2E authenticated 6 role nên triển khai thành PR kế tiếp để tránh trộn thay đổi lớn với learner hotfix.
