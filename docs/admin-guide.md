# Hướng dẫn quản trị

Tài khoản `ADMIN` có toàn quyền vận hành. `MANAGER` được quản lý nghiệp vụ nhưng
không thể tạo, xem hoặc tác động tài khoản `ADMIN`, và không được thay đổi cài
đặt hệ thống.

## Đăng nhập lần đầu

1. Đặt `SEED_ADMIN_EMAIL` bằng email Google thật của quản trị viên.
2. Chạy migration và seed.
3. Đăng nhập bằng đúng tài khoản Google đó.
4. Vào **Tài khoản → Tạo tài khoản** để tạo trước email cho các thành viên khác.

Hệ thống không có đăng ký công khai. Email chưa được quản trị viên tạo trước sẽ
không thể đăng nhập.

## Tài khoản

Mỗi dòng có nút **Xem** và **Sửa**. Trang chi tiết hỗ trợ:

- cập nhật họ tên và hồ sơ theo vai trò;
- đổi vai trò và tự động thu hồi phiên đăng nhập cũ;
- khóa/mở khóa, xóa mềm/khôi phục và thu hồi toàn bộ phiên;
- liên kết hoặc gỡ học sinh khỏi tài khoản phụ huynh;
- xem lớp đang dạy, trợ giảng hoặc theo học.

“Xóa” tài khoản là xóa mềm để giữ điểm, điểm danh và audit. Tài khoản đã xóa có
thể được khôi phục.

## Môn học, lớp và buổi học

- **Môn học:** tạo, xem lớp liên quan, sửa, ngừng dùng hoặc kích hoạt lại.
- **Lớp:** sửa thông tin, trạng thái và sức chứa; phân/gỡ giáo viên, trợ giảng;
  thêm, gỡ hoặc chuyển học sinh; mở danh sách buổi học.
- **Buổi học:** tạo/sửa lịch, hủy buổi, mở/đóng điểm danh và chuyển thẳng tới
  danh sách điểm danh.

Lớp và môn học đang được tham chiếu không bị xóa vật lý. Hệ thống dùng trạng thái
ngừng hoạt động/lưu trữ để bảo toàn lịch sử.

## Nội dung

Từ **Nội dung**, **Video**, **Tài liệu**, **Bài tập** hoặc **Bài kiểm tra**, chọn
nút tạo mới. Nội dung phải gắn với một lớp và một buổi học.

- Lesson hỗ trợ Markdown, công thức và mục tiêu học tập.
- Material tải tệp bảo vệ.
- Video tải streaming, sau đó worker tạo HLS/thumbnail.
- Assignment và Quiz có trình tạo câu hỏi, đáp án và thang điểm.

Nội dung đã xuất bản bị khóa. Người tạo gửi yêu cầu mở lại; Admin/Manager duyệt
để hệ thống tạo phiên bản mới rồi mới chỉnh sửa. Không sửa trực tiếp bản đang
chờ duyệt hoặc bản đã công bố.

## Điểm danh và chấm điểm

- **Điểm danh:** mở một buổi học, chọn trạng thái từng học sinh, ghi chú và lý
  do điều chỉnh. Mọi thay đổi đều có lịch sử.
- **Chấm điểm:** danh sách hợp nhất bài tập và quiz. Giáo viên/Admin/Manager lưu
  điểm chính thức và công bố; trợ giảng chỉ lưu điểm đề xuất. Trang chi tiết hiển
  thị câu hỏi, đáp án học sinh, đáp án đúng và điểm tự động.

## Báo cáo, job, audit và cài đặt

- Báo cáo chạy nền; tải tệp khi trạng thái là `READY`.
- Job lỗi có thể được thử lại với lý do và giới hạn số lần.
- Audit cho phép xem actor, thao tác, lý do cùng giá trị trước/sau.
- Cài đặt chỉ dành cho `ADMIN`; giá trị dùng JSON hợp lệ.

## Lỗi cấu hình thường gặp

`OAUTH_TOKEN_ENCRYPTION_KEY` phải là 32 byte biểu diễn bằng đúng 64 ký tự hex.
Có thể tạo bằng:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Sau khi đổi biến môi trường, cần khởi động lại app và worker. Không thay khóa này
sau khi đã có token OAuth được mã hóa nếu chưa chuẩn bị quy trình liên kết lại.
