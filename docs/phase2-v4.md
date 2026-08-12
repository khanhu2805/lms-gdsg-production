# Phase 2 v4 — Parent scope, role dashboards and pagination

Bản vá này giả định learner flow v3 đã được áp dụng và `npm run check` đã chạy thành công.

## Thay đổi chính

- Dashboard theo 6 vai trò thay vì một dashboard chung.
- Parent có bộ chọn con trên dashboard và các màn hình dữ liệu theo học sinh.
- Mọi `studentId` do Parent gửi qua URL đều được xác minh lại bằng `ParentStudentLink.status = ACTIVE` ở server.
- Sessions, assignments, quizzes, attendance, results và progress của Parent được scope theo học sinh đang chọn.
- Kết quả bài tập hiển thị `teacherFeedback` chỉ sau khi submission đã được công bố.
- Danh sách dashboard có phân trang server-side với page size 20/50/100.
- Teacher và Teaching Assistant có menu tiến độ học sinh.
- Giảm tải option list cũ từ 1000 users / 2000 sessions và không còn tải common options cho các resource page không cần chúng.
- Thêm unit test cho parsing page/pageSize.

## Lưu ý dữ liệu

Schema hiện không có trường nhận xét tổng ở `QuizAttempt`, vì vậy trang kết quả không tự tạo hoặc suy diễn nhận xét cho Quiz. Schema cũng chỉ có `VideoProgress`; chưa có model tiến độ riêng cho Lesson, nên Parent dashboard chỉ tổng hợp tiến độ video từ dữ liệu thực tế hiện có.
