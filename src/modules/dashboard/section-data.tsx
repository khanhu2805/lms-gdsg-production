import "server-only";

import Link from "next/link";

import type { TableRow } from "@/components/ui/data-table";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { formatDate, formatDateTime } from "@/lib/utils";
import { classScopeWhere } from "@/modules/classes/class.repository";

export type SectionData = {
  columns: string[];
  rows: TableRow[];
};

function textMatch(search: string | undefined) {
  return search
    ? { contains: search, mode: "insensitive" as const }
    : undefined;
}

function pill(value: string) {
  return (
    <span className="inline-flex rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-semibold text-[#475467]">
      {value}
    </span>
  );
}

function rowActions(
  href: string,
  options: { canEdit?: boolean; editLabel?: string } = {},
) {
  return (
    <div className="flex min-w-max items-center gap-2">
      <Link
        href={href}
        className="inline-flex min-h-9 items-center rounded-lg border border-[#D0D5DD] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
      >
        Xem
      </Link>
      {options.canEdit ? (
        <Link
          href={`${href}#edit`}
          className="inline-flex min-h-9 items-center rounded-lg bg-[#4059A5] px-3 text-xs font-semibold text-white hover:bg-[#304783]"
        >
          {options.editLabel ?? "Sửa"}
        </Link>
      ) : null}
    </div>
  );
}

export async function loadSectionData(
  actor: Actor,
  section: string,
  search?: string,
  options: { page?: number; pageSize?: number; studentId?: string } = {},
): Promise<SectionData> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = [20, 50, 100].includes(options.pageSize ?? 20)
    ? (options.pageSize ?? 20)
    : 20;
  const skip = (page - 1) * pageSize;
  const take = pageSize + 1;

  let parentStudentId: string | undefined;
  if (actor.role === "PARENT" && options.studentId) {
    const link = await prisma.parentStudentLink.findFirst({
      where: {
        parentId: actor.id,
        studentId: options.studentId,
        status: "ACTIVE",
      },
      select: { studentId: true },
    });
    if (!link) throw new AppError("FORBIDDEN");
    parentStudentId = link.studentId;
  }

  const classes = await prisma.courseClass.findMany({
    where:
      actor.role === "PARENT" && parentStudentId
        ? {
            status: "ACTIVE",
            students: {
              some: { studentId: parentStudentId, status: "ACTIVE" },
            },
          }
        : classScopeWhere(actor),
    select: { id: true },
  });
  const classIds = classes.map(({ id }) => id);
  const isStaffActor = [
    "ADMIN",
    "MANAGER",
    "TEACHER",
    "TEACHING_ASSISTANT",
  ].includes(actor.role);

  if (section === "users") {
    const users = await prisma.user.findMany({
      where: {
        ...(actor.role === "MANAGER"
          ? { role: { not: "ADMIN" as const } }
          : {}),
        ...(search
          ? {
              OR: [{ name: textMatch(search) }, { email: textMatch(search) }],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      skip,
      take,
    });
    return {
      columns: [
        "Người dùng",
        "Vai trò",
        "Trạng thái",
        "Đăng nhập gần nhất",
        "Thao tác",
      ],
      rows: users.map((user) => ({
        id: user.id,
        cells: [
          <div key="identity">
            <p className="font-semibold text-[#172033]">{user.name}</p>
            <p className="mt-1 text-xs text-[#667085]">{user.email}</p>
          </div>,
          <RoleBadge key="role" role={user.role} />,
          <StatusBadge key="status" status={user.status} />,
          formatDateTime(user.lastLoginAt),
          rowActions(`/dashboard/users/${user.id}`, { canEdit: true }),
        ],
      })),
    };
  }

  if (section === "subjects") {
    const subjects = await prisma.subject.findMany({
      where: search
        ? { OR: [{ code: textMatch(search) }, { name: textMatch(search) }] }
        : {},
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
      skip,
      take,
    });
    return {
      columns: ["Mã", "Môn học", "Số lớp", "Trạng thái", "Thao tác"],
      rows: subjects.map((subject) => ({
        id: subject.id,
        cells: [
          <span key="code" className="font-semibold text-[#4059A5]">
            {subject.code}
          </span>,
          subject.name,
          subject._count.classes,
          pill(subject.isActive ? "Đang dùng" : "Ngừng dùng"),
          rowActions(`/dashboard/subjects/${subject.id}`, { canEdit: true }),
        ],
      })),
    };
  }

  if (section === "classes") {
    const rows = await prisma.courseClass.findMany({
      where: {
        AND: [
          classScopeWhere(actor),
          search
            ? { OR: [{ code: textMatch(search) }, { name: textMatch(search) }] }
            : {},
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        academicYear: true,
        capacity: true,
        mode: true,
        status: true,
        subject: { select: { name: true } },
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
      },
      orderBy: [{ status: "asc" }, { code: "asc" }],
      skip,
      take,
    });
    return {
      columns: [
        "Lớp",
        "Môn học",
        "Năm học",
        "Sĩ số",
        "Trạng thái",
        ...(isStaffActor ? ["Thao tác"] : []),
      ],
      rows: rows.map((courseClass) => ({
        id: courseClass.id,
        cells: [
          <div key="class">
            <p className="font-semibold text-[#172033]">{courseClass.name}</p>
            <p className="mt-1 text-xs text-[#667085]">
              {courseClass.code} · {courseClass.mode}
            </p>
          </div>,
          courseClass.subject.name,
          courseClass.academicYear,
          `${courseClass._count.students}/${courseClass.capacity}`,
          <StatusBadge key="status" status={courseClass.status} />,
          ...(isStaffActor
            ? [
                rowActions(`/dashboard/classes/${courseClass.id}`, {
                  canEdit: actor.role === "ADMIN" || actor.role === "MANAGER",
                }),
              ]
            : []),
        ],
      })),
    };
  }

  if (section === "sessions") {
    const sessions = await prisma.classSession.findMany({
      where: {
        classId: { in: classIds },
        ...(search
          ? {
              OR: [
                { title: textMatch(search) },
                { courseClass: { code: textMatch(search) } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        sessionNumber: true,
        title: true,
        startAt: true,
        endAt: true,
        mode: true,
        room: true,
        status: true,
        attendanceOpen: true,
        courseClass: { select: { code: true } },
      },
      orderBy: { startAt: "desc" },
      skip,
      take,
    });
    return {
      columns: [
        "Buổi học",
        "Lớp",
        "Bắt đầu",
        "Hình thức",
        "Trạng thái",
        "Thao tác",
      ],
      rows: sessions.map((session) => ({
        id: session.id,
        cells: [
          <div key="session">
            <p className="font-semibold text-[#172033]">{session.title}</p>
            <p className="mt-1 text-xs text-[#667085]">
              Buổi {session.sessionNumber}
            </p>
          </div>,
          session.courseClass.code,
          formatDateTime(session.startAt),
          session.mode === "ONLINE"
            ? "Trực tuyến"
            : (session.room ?? "Tại lớp"),
          pill(session.attendanceOpen ? "Đang điểm danh" : session.status),
          rowActions(`/dashboard/sessions/${session.id}`, {
            canEdit: actor.role === "ADMIN" || actor.role === "MANAGER",
          }),
        ],
      })),
    };
  }

  const contentTypeBySection = {
    videos: "VIDEO",
    materials: "MATERIAL",
    assignments: "ASSIGNMENT",
    quizzes: "QUIZ",
    lessons: "LESSON",
  } as const;
  if (
    section === "contents" ||
    section === "reviews" ||
    section in contentTypeBySection
  ) {
    const type =
      section in contentTypeBySection
        ? contentTypeBySection[section as keyof typeof contentTypeBySection]
        : undefined;
    const contents = await prisma.content.findMany({
      where: {
        classId: { in: classIds },
        deletedAt: null,
        type,
        publicationStatus:
          section === "reviews"
            ? "PENDING_TEACHER_REVIEW"
            : actor.role === "STUDENT" || actor.role === "PARENT"
              ? "PUBLISHED"
              : undefined,
        ...(search
          ? {
              OR: [
                { title: textMatch(search) },
                { courseClass: { code: textMatch(search) } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        type: true,
        publicationStatus: true,
        version: true,
        updatedAt: true,
        creator: { select: { name: true } },
        recording: { select: { id: true } },
        courseClass: { select: { code: true } },
        classSession: { select: { sessionNumber: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take,
    });
    return {
      columns: [
        "Nội dung",
        "Lớp / buổi",
        "Người tạo",
        "Phiên bản",
        "Trạng thái",
        ...(isStaffActor ? ["Thao tác"] : []),
      ],
      rows: contents.map((content) => ({
        id: content.id,
        cells: [
          <div key="content">
            {section === "videos" && content.recording ? (
              <Link
                href={`/dashboard/videos/${content.recording.id}`}
                className="font-semibold text-[#4059A5] hover:text-[#243467] hover:underline"
              >
                {content.title}
              </Link>
            ) : (
              <p className="font-semibold text-[#172033]">{content.title}</p>
            )}
            <p className="mt-1 text-xs text-[#667085]">{content.type}</p>
          </div>,
          `${content.courseClass.code} / ${content.classSession.sessionNumber}`,
          content.creator.name,
          `v${content.version}`,
          <StatusBadge key="status" status={content.publicationStatus} />,
          ...(isStaffActor
            ? [
                rowActions(`/dashboard/contents/${content.id}`, {
                  canEdit: true,
                }),
              ]
            : []),
        ],
      })),
    };
  }

  if (section === "attendance") {
    const attendance = await prisma.attendance.findMany({
      where: {
        classSession: { classId: { in: classIds } },
        ...(actor.role === "STUDENT" ? { studentId: actor.id } : {}),
        ...(actor.role === "PARENT"
          ? parentStudentId
            ? { studentId: parentStudentId }
            : {
                student: {
                  studentParentLinks: {
                    some: { parentId: actor.id, status: "ACTIVE" },
                  },
                },
              }
          : {}),
        ...(search
          ? {
              OR: [
                { student: { name: textMatch(search) } },
                { classSession: { title: textMatch(search) } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        markedAt: true,
        note: true,
        student: { select: { name: true } },
        classSession: {
          select: {
            id: true,
            title: true,
            courseClass: { select: { code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    return {
      columns: [
        "Học sinh",
        "Lớp / buổi",
        "Trạng thái",
        "Ghi nhận",
        "Ghi chú",
        ...(isStaffActor ? ["Thao tác"] : []),
      ],
      rows: attendance.map((record) => ({
        id: record.id,
        cells: [
          record.student.name,
          `${record.classSession.courseClass.code} · ${record.classSession.title}`,
          <StatusBadge key="status" status={record.status} />,
          formatDateTime(record.markedAt),
          record.note ?? "—",
          ...(isStaffActor
            ? [
                rowActions(`/dashboard/attendance/${record.classSession.id}`, {
                  canEdit: true,
                  editLabel: "Điểm danh",
                }),
              ]
            : []),
        ],
      })),
    };
  }

  if (section === "grading") {
    const [submissions, quizAttempts] = await Promise.all([
      prisma.submission.findMany({
        where: {
          assignment: { content: { classId: { in: classIds } } },
          status: { not: "DRAFT" },
          ...(search ? { student: { name: textMatch(search) } } : {}),
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          finalScore: true,
          assistantSuggestedScore: true,
          student: { select: { name: true } },
          assignment: {
            select: {
              maxScore: true,
              content: { select: { title: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: skip + take,
      }),
      prisma.quizAttempt.findMany({
        where: {
          quiz: { content: { classId: { in: classIds } } },
          status: { not: "IN_PROGRESS" },
          ...(search ? { student: { name: textMatch(search) } } : {}),
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          finalScore: true,
          assistantSuggestedScore: true,
          student: { select: { name: true } },
          quiz: {
            select: {
              maxScore: true,
              content: { select: { title: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: skip + take,
      }),
    ]);
    const rows = [
      ...submissions.map((submission) => ({
        id: submission.id,
        submittedAt: submission.submittedAt,
        cells: [
          submission.student.name,
          submission.assignment.content.title,
          pill("Bài tập"),
          formatDateTime(submission.submittedAt),
          submission.finalScore !== null
            ? `${submission.finalScore}/${submission.assignment.maxScore}`
            : submission.assistantSuggestedScore !== null
              ? `Đề xuất ${submission.assistantSuggestedScore}`
              : "Chưa chấm",
          pill(submission.status),
          rowActions(`/dashboard/grading/${submission.id}`, {
            canEdit: true,
            editLabel: "Chấm bài",
          }),
        ],
      })),
      ...quizAttempts.map((attempt) => ({
        id: `quiz-${attempt.id}`,
        submittedAt: attempt.submittedAt,
        cells: [
          attempt.student.name,
          attempt.quiz.content.title,
          pill("Bài kiểm tra"),
          formatDateTime(attempt.submittedAt),
          attempt.finalScore !== null
            ? `${attempt.finalScore}/${attempt.quiz.maxScore}`
            : attempt.assistantSuggestedScore !== null
              ? `Đề xuất ${attempt.assistantSuggestedScore}`
              : "Chưa chấm",
          pill(attempt.status),
          rowActions(`/dashboard/grading/quiz-${attempt.id}`, {
            canEdit: true,
            editLabel: "Chấm quiz",
          }),
        ],
      })),
    ]
      .sort(
        (left, right) =>
          (right.submittedAt?.getTime() ?? 0) -
          (left.submittedAt?.getTime() ?? 0),
      )
      .slice(skip, skip + take)
      .map(({ id, cells }) => ({ id, cells }));

    return {
      columns: [
        "Học sinh",
        "Hoạt động",
        "Loại",
        "Nộp lúc",
        "Điểm",
        "Trạng thái",
        "Thao tác",
      ],
      rows,
    };
  }

  if (section === "reports") {
    const reports = await prisma.report.findMany({
      where:
        actor.role === "ADMIN" || actor.role === "MANAGER"
          ? {}
          : { requestedById: actor.id },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        fileAssetId: true,
        requestedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    return {
      columns: [
        "Loại",
        "Người yêu cầu",
        "Tạo lúc",
        "Hết hạn",
        "Trạng thái",
        "Thao tác",
      ],
      rows: reports.map((report) => ({
        id: report.id,
        cells: [
          report.type,
          report.requestedBy.name,
          formatDateTime(report.createdAt),
          formatDateTime(report.expiresAt),
          pill(report.status),
          rowActions(`/dashboard/reports/${report.id}`),
        ],
      })),
    };
  }

  if (section === "jobs") {
    const allJobs = await prisma.job.findMany({
      select: {
        id: true,
        type: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        scheduledAt: true,
        errorMessage: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    const jobs = search
      ? allJobs.filter((job) => job.type.includes(search.trim().toUpperCase()))
      : allJobs;
    return {
      columns: [
        "Job",
        "Lịch chạy",
        "Số lần thử",
        "Trạng thái",
        "Lỗi gần nhất",
        "Thao tác",
      ],
      rows: jobs.map((job) => ({
        id: job.id,
        cells: [
          <span key="type" className="font-semibold text-[#172033]">
            {job.type}
          </span>,
          formatDateTime(job.scheduledAt),
          `${job.attempts}/${job.maxAttempts}`,
          <StatusBadge key="status" status={job.status} />,
          job.errorMessage?.slice(0, 100) ?? "—",
          rowActions(`/dashboard/jobs/${job.id}`, {
            canEdit: job.status === "FAILED",
            editLabel: "Chạy lại",
          }),
        ],
      })),
    };
  }

  if (section === "audit") {
    const logs = await prisma.auditLog.findMany({
      where: search
        ? {
            OR: [
              { action: textMatch(search) },
              { entityType: textMatch(search) },
              { entityId: textMatch(search) },
            ],
          }
        : {},
      select: {
        id: true,
        action: true,
        actorRole: true,
        entityType: true,
        entityId: true,
        reason: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    return {
      columns: [
        "Thao tác",
        "Người thực hiện",
        "Tài nguyên",
        "Lý do",
        "Thời gian",
        "Chi tiết",
      ],
      rows: logs.map((log) => ({
        id: log.id,
        cells: [
          <span key="action" className="font-semibold text-[#172033]">
            {log.action}
          </span>,
          log.actor?.name ?? `Hệ thống (${log.actorRole})`,
          `${log.entityType} · ${log.entityId.slice(0, 8)}`,
          log.reason ?? "—",
          formatDateTime(log.createdAt),
          rowActions(`/dashboard/audit/${log.id}`),
        ],
      })),
    };
  }

  if (section === "children") {
    const links = await prisma.parentStudentLink.findMany({
      where: {
        parentId: actor.id,
        status: "ACTIVE",
        ...(search ? { student: { name: textMatch(search) } } : {}),
      },
      select: {
        id: true,
        isPrimary: true,
        linkedAt: true,
        student: {
          select: {
            name: true,
            email: true,
            profile: { select: { studentCode: true } },
            studentMemberships: {
              where: { status: "ACTIVE" },
              select: { courseClass: { select: { code: true } } },
            },
          },
        },
      },
      orderBy: { linkedAt: "desc" },
      skip,
      take,
    });
    return {
      columns: ["Học sinh", "Mã", "Lớp đang học", "Liên kết", "Vai trò"],
      rows: links.map((link) => ({
        id: link.id,
        cells: [
          <div key="student">
            <p className="font-semibold text-[#172033]">{link.student.name}</p>
            <p className="mt-1 text-xs text-[#667085]">{link.student.email}</p>
          </div>,
          link.student.profile?.studentCode ?? "—",
          link.student.studentMemberships
            .map(({ courseClass }) => courseClass.code)
            .join(", ") || "—",
          formatDate(link.linkedAt),
          pill(link.isPrimary ? "Phụ huynh chính" : "Phụ huynh"),
        ],
      })),
    };
  }

  if (section === "results") {
    const studentIds =
      actor.role === "STUDENT"
        ? [actor.id]
        : parentStudentId
          ? [parentStudentId]
          : (
              await prisma.parentStudentLink.findMany({
                where: { parentId: actor.id, status: "ACTIVE" },
                select: { studentId: true },
              })
            ).map(({ studentId }) => studentId);
    const [submissions, attempts] = await Promise.all([
      prisma.submission.findMany({
        where: {
          studentId: { in: studentIds },
          publishedAt: { not: null },
        },
        select: {
          id: true,
          finalScore: true,
          teacherFeedback: true,
          publishedAt: true,
          student: { select: { name: true } },
          assignment: {
            select: {
              maxScore: true,
              content: { select: { title: true } },
            },
          },
        },
        orderBy: { publishedAt: "desc" },
      take: skip + take,
      }),
      prisma.quizAttempt.findMany({
        where: {
          studentId: { in: studentIds },
          publishedAt: { not: null },
        },
        select: {
          id: true,
          finalScore: true,
          publishedAt: true,
          student: { select: { name: true } },
          quiz: {
            select: {
              maxScore: true,
              content: { select: { title: true } },
            },
          },
        },
        orderBy: { publishedAt: "desc" },
      take: skip + take,
      }),
    ]);
    const rows = [
      ...submissions.map((result) => ({
        id: `assignment-${result.id}`,
        publishedAt: result.publishedAt,
        cells: [
          result.student.name,
          result.assignment.content.title,
          pill("Bài tập"),
          `${result.finalScore ?? "—"}/${result.assignment.maxScore}`,
          result.teacherFeedback?.trim() || "—",
          formatDateTime(result.publishedAt),
        ],
      })),
      ...attempts.map((result) => ({
        id: `quiz-${result.id}`,
        publishedAt: result.publishedAt,
        cells: [
          result.student.name,
          result.quiz.content.title,
          pill("Bài kiểm tra"),
          `${result.finalScore ?? "—"}/${result.quiz.maxScore}`,
          "—",
          formatDateTime(result.publishedAt),
        ],
      })),
    ]
      .sort(
        (left, right) =>
          (right.publishedAt?.getTime() ?? 0) -
          (left.publishedAt?.getTime() ?? 0),
      )
      .slice(skip, skip + take)
      .map(({ id, cells }) => ({ id, cells }));

    return {
      columns: [
        "Học sinh",
        "Hoạt động",
        "Loại",
        "Điểm",
        "Nhận xét",
        "Công bố",
      ],
      rows,
    };
  }

  if (section === "progress") {
    const progress = await prisma.videoProgress.findMany({
      where: {
        recording: { content: { classId: { in: classIds } } },
        ...(actor.role === "STUDENT" ? { userId: actor.id } : {}),
        ...(actor.role === "PARENT"
          ? parentStudentId
            ? { userId: parentStudentId }
            : {
                user: {
                  studentParentLinks: {
                    some: { parentId: actor.id, status: "ACTIVE" },
                  },
                },
              }
          : {}),
      },
      select: {
        id: true,
        percentage: true,
        completed: true,
        lastViewedAt: true,
        user: { select: { name: true } },
        recording: { select: { content: { select: { title: true } } } },
      },
      orderBy: { lastViewedAt: "desc" },
      skip,
      take,
    });
    return {
      columns: ["Học sinh", "Video", "Tiến độ", "Hoàn thành", "Xem gần nhất"],
      rows: progress.map((item) => ({
        id: item.id,
        cells: [
          item.user.name,
          item.recording.content.title,
          `${item.percentage}%`,
          pill(item.completed ? "Đã hoàn thành" : "Đang học"),
          formatDateTime(item.lastViewedAt),
        ],
      })),
    };
  }

  if (section === "settings") {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });
    return {
      columns: ["Khóa", "Giá trị", "Mô tả", "Cập nhật", "Thao tác"],
      rows: settings.map((setting) => ({
        id: setting.key,
        cells: [
          <code key="key" className="text-xs font-semibold text-[#4059A5]">
            {setting.key}
          </code>,
          JSON.stringify(setting.value),
          setting.description ?? "—",
          formatDateTime(setting.updatedAt),
          rowActions(`/dashboard/settings/${encodeURIComponent(setting.key)}`, {
            canEdit: true,
          }),
        ],
      })),
    };
  }

  if (section === "profile") {
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      include: { profile: true },
    });
    if (!user) return { columns: [], rows: [] };
    return {
      columns: ["Thông tin", "Giá trị"],
      rows: [
        { id: "name", cells: ["Họ và tên", user.name] },
        { id: "email", cells: ["Email", user.email] },
        {
          id: "role",
          cells: ["Vai trò", <RoleBadge key="role" role={user.role} />],
        },
        { id: "phone", cells: ["Điện thoại", user.profile?.phone ?? "—"] },
        {
          id: "last-login",
          cells: ["Đăng nhập gần nhất", formatDateTime(user.lastLoginAt)],
        },
      ],
    };
  }

  return { columns: [], rows: [] };
}
