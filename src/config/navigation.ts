import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  GraduationCap,
  HardDrive,
  History,
  House,
  LibraryBig,
  ListChecks,
  NotebookTabs,
  Settings,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";

import type { UserRole } from "@/generated/prisma/enums";

export type NavigationItem = {
  label: string;
  href: string;
  icon: typeof House;
};

const common = {
  dashboard: { label: "Tổng quan", href: "/dashboard", icon: Gauge },
  profile: { label: "Hồ sơ", href: "/dashboard/profile", icon: Settings },
} satisfies Record<string, NavigationItem>;

export const NAVIGATION_BY_ROLE: Record<UserRole, NavigationItem[]> = {
  ADMIN: [
    common.dashboard,
    { label: "Tài khoản", href: "/dashboard/users", icon: Users },
    { label: "Môn học", href: "/dashboard/subjects", icon: LibraryBig },
    { label: "Lớp học", href: "/dashboard/classes", icon: GraduationCap },
    { label: "Buổi học", href: "/dashboard/sessions", icon: CalendarDays },
    { label: "Nội dung", href: "/dashboard/contents", icon: BookOpen },
    { label: "Video", href: "/dashboard/videos", icon: Video },
    { label: "Tài liệu", href: "/dashboard/materials", icon: FileText },
    { label: "Bài tập", href: "/dashboard/assignments", icon: NotebookTabs },
    { label: "Bài kiểm tra", href: "/dashboard/quizzes", icon: ListChecks },
    { label: "Điểm danh", href: "/dashboard/attendance", icon: ClipboardCheck },
    { label: "Chấm điểm", href: "/dashboard/grading", icon: FileCheck2 },
    { label: "Báo cáo", href: "/dashboard/reports", icon: ChartNoAxesCombined },
    { label: "Job nền", href: "/dashboard/jobs", icon: HardDrive },
    { label: "Nhật ký", href: "/dashboard/audit", icon: History },
    { label: "Cài đặt", href: "/dashboard/settings", icon: ShieldCheck },
  ],
  MANAGER: [
    common.dashboard,
    { label: "Tài khoản", href: "/dashboard/users", icon: Users },
    { label: "Môn học", href: "/dashboard/subjects", icon: LibraryBig },
    { label: "Lớp học", href: "/dashboard/classes", icon: GraduationCap },
    { label: "Buổi học", href: "/dashboard/sessions", icon: CalendarDays },
    { label: "Nội dung", href: "/dashboard/contents", icon: BookOpen },
    { label: "Điểm danh", href: "/dashboard/attendance", icon: ClipboardCheck },
    { label: "Chấm điểm", href: "/dashboard/grading", icon: FileCheck2 },
    { label: "Báo cáo", href: "/dashboard/reports", icon: ChartNoAxesCombined },
    { label: "Job nền", href: "/dashboard/jobs", icon: HardDrive },
    { label: "Nhật ký", href: "/dashboard/audit", icon: History },
  ],
  TEACHER: [
    common.dashboard,
    { label: "Lớp phụ trách", href: "/dashboard/classes", icon: GraduationCap },
    { label: "Lịch dạy", href: "/dashboard/sessions", icon: CalendarDays },
    { label: "Nội dung", href: "/dashboard/contents", icon: BookOpen },
    { label: "Duyệt nội dung", href: "/dashboard/reviews", icon: FileCheck2 },
    { label: "Điểm danh", href: "/dashboard/attendance", icon: ClipboardCheck },
    { label: "Chấm bài", href: "/dashboard/grading", icon: ListChecks },
    {
      label: "Tiến độ học sinh",
      href: "/dashboard/progress",
      icon: ChartNoAxesCombined,
    },
    {
      label: "Báo cáo lớp",
      href: "/dashboard/reports",
      icon: ChartNoAxesCombined,
    },
    common.profile,
  ],
  TEACHING_ASSISTANT: [
    common.dashboard,
    { label: "Lớp được giao", href: "/dashboard/classes", icon: GraduationCap },
    { label: "Lịch học", href: "/dashboard/sessions", icon: CalendarDays },
    { label: "Nội dung của tôi", href: "/dashboard/contents", icon: BookOpen },
    { label: "Điểm danh", href: "/dashboard/attendance", icon: ClipboardCheck },
    { label: "Hỗ trợ chấm", href: "/dashboard/grading", icon: FileCheck2 },
    {
      label: "Tiến độ học sinh",
      href: "/dashboard/progress",
      icon: ChartNoAxesCombined,
    },
    common.profile,
  ],
  STUDENT: [
    { label: "Trang chủ", href: "/dashboard", icon: House },
    { label: "Lớp học", href: "/dashboard/classes", icon: GraduationCap },
    { label: "Lịch học", href: "/dashboard/sessions", icon: CalendarDays },
    { label: "Bài học", href: "/dashboard/lessons", icon: BookOpen },
    { label: "Tài liệu", href: "/dashboard/materials", icon: FileText },
    { label: "Video", href: "/dashboard/videos", icon: Video },
    { label: "Bài tập", href: "/dashboard/assignments", icon: NotebookTabs },
    { label: "Bài kiểm tra", href: "/dashboard/quizzes", icon: ListChecks },
    { label: "Kết quả", href: "/dashboard/results", icon: FileCheck2 },
    { label: "Điểm danh", href: "/dashboard/attendance", icon: ClipboardCheck },
    {
      label: "Tiến độ",
      href: "/dashboard/progress",
      icon: ChartNoAxesCombined,
    },
    common.profile,
  ],
  PARENT: [
    { label: "Trang chủ", href: "/dashboard", icon: House },
    { label: "Con của tôi", href: "/dashboard/children", icon: Users },
    { label: "Lịch học", href: "/dashboard/sessions", icon: CalendarDays },
    { label: "Bài tập", href: "/dashboard/assignments", icon: NotebookTabs },
    { label: "Bài kiểm tra", href: "/dashboard/quizzes", icon: ListChecks },
    { label: "Kết quả", href: "/dashboard/results", icon: FileCheck2 },
    { label: "Điểm danh", href: "/dashboard/attendance", icon: ClipboardCheck },
    {
      label: "Tiến độ",
      href: "/dashboard/progress",
      icon: ChartNoAxesCombined,
    },
    common.profile,
  ],
};
