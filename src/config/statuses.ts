import type {
  AttendanceStatus,
  ClassSessionStatus,
  ClassStatus,
  ContentPublicationStatus,
  JobStatus,
  QuizAttemptStatus,
  SubmissionStatus,
  UserStatus,
} from "@/generated/prisma/enums";

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  LOCKED: "Đã khóa",
};

export const CLASS_STATUS_LABELS: Record<ClassStatus, string> = {
  DRAFT: "Bản nháp",
  ACTIVE: "Đang hoạt động",
  COMPLETED: "Đã hoàn thành",
  ARCHIVED: "Đã lưu trữ",
};

export const CLASS_SESSION_STATUS_LABELS: Record<
  ClassSessionStatus,
  string
> = {
  SCHEDULED: "Đã lên lịch",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
};

export const CONTENT_STATUS_LABELS: Record<
  ContentPublicationStatus,
  string
> = {
  DRAFT: "Bản nháp",
  PENDING_TEACHER_REVIEW: "Chờ giáo viên duyệt",
  CHANGES_REQUESTED: "Cần chỉnh sửa",
  APPROVED: "Đã duyệt",
  PUBLISHED: "Đã xuất bản",
  REOPEN_REQUESTED: "Đang yêu cầu mở lại",
  REOPENED: "Đã mở lại",
  REJECTED: "Bị từ chối",
  HIDDEN: "Đã ẩn",
  ARCHIVED: "Đã lưu trữ",
};

export const ATTENDANCE_STATUS_LABELS: Record<
  AttendanceStatus,
  string
> = {
  PRESENT: "Có mặt",
  LATE: "Đi trễ",
  ABSENT: "Vắng mặt",
  EXCUSED: "Vắng có phép",
  PENDING: "Chưa xác định",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  PENDING: "Đang chờ",
  PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn thành",
  FAILED: "Thất bại",
};

export const SUBMISSION_STATUS_LABELS: Record<
  SubmissionStatus,
  string
> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  GRADING: "Đang chấm",
  GRADED: "Đã chấm",
  RETURNED: "Đã trả bài",
  RESUBMISSION_REQUIRED: "Yêu cầu nộp lại",
};

export const QUIZ_ATTEMPT_STATUS_LABELS: Record<
  QuizAttemptStatus,
  string
> = {
  IN_PROGRESS: "Đang làm bài",
  SUBMITTED: "Đã nộp",
  GRADING: "Đang chấm",
  GRADED: "Đã chấm",
  EXPIRED: "Đã hết hạn",
};