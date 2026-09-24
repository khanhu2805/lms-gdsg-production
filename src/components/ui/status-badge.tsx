import {
  type AttendanceStatus,
  type ClassStatus,
  type ClassSessionStatus,
  type ContentPublicationStatus,
  type JobStatus,
  type UserStatus,
} from "@/generated/prisma/enums";
import {
  ATTENDANCE_STATUS_LABELS,
  CLASS_STATUS_LABELS,
  CLASS_SESSION_STATUS_LABELS,
  CONTENT_STATUS_LABELS,
  JOB_STATUS_LABELS,
  USER_STATUS_LABELS,
} from "@/config/statuses";
import { cn } from "@/lib/utils";

type SupportedStatus =
  | AttendanceStatus
  | ClassStatus
  | ClassSessionStatus
  | ContentPublicationStatus
  | JobStatus
  | UserStatus;

const labels: Partial<Record<SupportedStatus, string>> = {
  ...USER_STATUS_LABELS,
  ...CLASS_STATUS_LABELS,
  ...CLASS_SESSION_STATUS_LABELS,
  ...CONTENT_STATUS_LABELS,
  ...ATTENDANCE_STATUS_LABELS,
  ...JOB_STATUS_LABELS,
};

const styles: Partial<Record<SupportedStatus, string>> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ONGOING: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELLED: "bg-red-50 text-red-700 ring-red-600/20",
  SCHEDULED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PUBLISHED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PRESENT: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  APPROVED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  REOPENED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  EXCUSED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  PENDING_TEACHER_REVIEW: "bg-violet-50 text-violet-700 ring-violet-600/20",
  PENDING: "bg-slate-100 text-slate-700 ring-slate-600/20",
  PROCESSING: "bg-blue-50 text-blue-700 ring-blue-600/20",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  LATE: "bg-amber-50 text-amber-700 ring-amber-600/20",
  REOPEN_REQUESTED: "bg-orange-50 text-orange-700 ring-orange-600/20",
  LOCKED: "bg-red-50 text-red-700 ring-red-600/20",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
  ABSENT: "bg-red-50 text-red-700 ring-red-600/20",
  FAILED: "bg-red-50 text-red-700 ring-red-600/20",
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-600/20",
  INACTIVE: "bg-slate-100 text-slate-700 ring-slate-600/20",
  ARCHIVED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  HIDDEN: "bg-slate-200 text-slate-800 ring-slate-600/20",
};

export function StatusBadge({
  status,
  className,
}: {
  status: SupportedStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        styles[status] ?? "bg-slate-100 text-slate-700 ring-slate-600/20",
        className,
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
