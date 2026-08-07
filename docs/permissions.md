# Ma trận quyền

Mọi ô dưới đây là quyền phía máy chủ, không chỉ là ẩn/hiện nút giao diện.

| Khả năng                |      Admin |          Manager |          Teacher |     Assistant |  Student |       Parent |
| ----------------------- | ---------: | ---------------: | ---------------: | ------------: | -------: | -----------: |
| Quản lý Admin           |         Có |            Không |            Không |         Không |    Không |        Không |
| Quản lý user khác       |         Có |    Có, trừ Admin |            Không |         Không |    Không |        Không |
| Tạo/sửa lớp             |         Có |               Có |            Không |         Không |    Không |        Không |
| Vượt capacity           | Có + lý do | Có grant + lý do |            Không |         Không |    Không |        Không |
| Tạo/sửa buổi học        |         Có |               Có |            Không |         Không |    Không |        Không |
| Xem lớp                 |    Toàn bộ |          Toàn bộ |        Được giao |     Được giao | Đang học |   Có con học |
| Tạo content             |         Có |               Có |    Lớp được giao | Lớp được giao |    Không |        Không |
| Tự publish content      |         Có |               Có | Content của mình | Sau khi duyệt |    Không |        Không |
| Duyệt content Assistant |         Có |               Có |    Lớp được giao |         Không |    Không |        Không |
| Mở lại published        |         Có |               Có |      Chỉ yêu cầu |   Chỉ yêu cầu |    Không |        Không |
| Điểm danh thủ công      |         Có |               Có |    Lớp được giao | Lớp được giao |    Không |        Không |
| Nhập điểm đề xuất       |         Có |               Có |               Có |            Có |    Không |        Không |
| Công bố điểm chính thức |         Có |               Có |               Có |         Không |    Không |        Không |
| Xem kết quả learner     |    Toàn bộ |          Toàn bộ |    Lớp được giao | Lớp được giao | Bản thân | Con liên kết |
| Tạo report              |    Toàn bộ |          Toàn bộ |   Chỉ report lớp |         Không |    Không |        Không |
| Audit/job toàn cục      |         Có |               Có |            Không |         Không |    Không |        Không |

## Nguyên tắc IDOR

- Mỗi API nhận ID tài nguyên đều tải quan hệ lớp/ownership từ database.
- Student không được truyền `studentId` để đổi ngữ cảnh; service dùng ID từ
  session.
- Parent chỉ truy cập student khi có `ParentStudentLink` đang `ACTIVE`.
- Teacher/Assistant chỉ truy cập lớp có membership đang `ACTIVE`.
- Manager bị chặn khi target hoặc requested role là Admin.
- Tài khoản bị khóa/xóa/ngừng hoạt động bị từ chối ở mọi request, kể cả session
  cookie còn hạn.

## Tách nhiệm vụ

- Trợ giảng có thể đề xuất điểm nhưng không thể công bố `finalScore`.
- Content của trợ giảng phải qua review.
- Published content không sửa trực tiếp; Admin/Manager phê duyệt reopen và tạo
  version mới.
- Không ai được tự khóa/xóa tài khoản Admin đang đăng nhập; service cũng giữ ít
  nhất một Admin hoạt động.
