import "server-only";

import type { Actor } from "@/lib/auth/actor";
import {
  assertClassAccess,
  assertStaffClassAccess,
} from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { classScopeWhere } from "@/modules/classes/class.repository";
import { getContentDetail } from "@/modules/contents/content.service";
import { getAccessibleSessionDetail } from "@/modules/sessions/session.service";
import { getManagedUserDetail } from "@/modules/users/user.service";

export type ResourceOption = {
  id: string;
  label: string;
  role?: string;
  classId?: string;
  status?: string;
};

export type ResourcePageData = {
  section: string;
  mode: "create" | "detail";
  canEdit: boolean;
  entity: unknown;
  options: {
    subjects: ResourceOption[];
    classes: ResourceOption[];
    sessions: ResourceOption[];
    users: ResourceOption[];
  };
};

const EMPTY_OPTIONS: ResourcePageData["options"] = {
  subjects: [],
  classes: [],
  sessions: [],
  users: [],
};

function toSerializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
}

function assertRole(actor: Actor, roles: Actor["role"][]) {
  if (!roles.includes(actor.role)) throw new AppError("FORBIDDEN");
}

async function loadCommonOptions(actor: Actor) {
  const canAdminister = actor.role === "ADMIN" || actor.role === "MANAGER";
  const isStaff = [
    "ADMIN",
    "MANAGER",
    "TEACHER",
    "TEACHING_ASSISTANT",
  ].includes(actor.role);

  const [subjects, classes, users] = await Promise.all([
    canAdminister
      ? prisma.subject.findMany({
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    isStaff
      ? prisma.courseClass.findMany({
          where: {
            AND: [
              classScopeWhere(actor),
              { status: { not: "ARCHIVED" as const } },
            ],
          },
          select: { id: true, code: true, name: true, status: true },
          orderBy: { code: "asc" },
        })
      : Promise.resolve([]),
    canAdminister
      ? prisma.user.findMany({
          where: {
            status: "ACTIVE",
            deletedAt: null,
            role:
              actor.role === "MANAGER"
                ? { in: ["TEACHER", "TEACHING_ASSISTANT", "STUDENT", "PARENT"] }
                : {
                    in: [
                      "ADMIN",
                      "MANAGER",
                      "TEACHER",
                      "TEACHING_ASSISTANT",
                      "STUDENT",
                      "PARENT",
                    ],
                  },
          },
          select: { id: true, name: true, email: true, role: true },
          orderBy: [{ role: "asc" }, { name: "asc" }],
          take: 1000,
        })
      : Promise.resolve([]),
  ]);

  const classIds = classes.map(({ id }) => id);
  const sessions =
    classIds.length > 0
      ? await prisma.classSession.findMany({
          where: {
            classId: { in: classIds },
            status: { not: "CANCELLED" },
          },
          select: {
            id: true,
            classId: true,
            sessionNumber: true,
            title: true,
            status: true,
            courseClass: { select: { code: true } },
          },
          orderBy: [{ startAt: "desc" }],
          take: 2000,
        })
      : [];

  return {
    subjects: subjects.map((subject) => ({
      id: subject.id,
      label: `${subject.code} · ${subject.name}`,
    })),
    classes: classes.map((courseClass) => ({
      id: courseClass.id,
      label: `${courseClass.code} · ${courseClass.name}`,
      status: courseClass.status,
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      classId: session.classId,
      label: `${session.courseClass.code} · Buổi ${session.sessionNumber}: ${session.title}`,
      status: session.status,
    })),
    users: users.map((user) => ({
      id: user.id,
      label: `${user.name} · ${user.email}`,
      role: user.role,
    })),
  };
}

export async function loadResourcePageData(
  actor: Actor,
  section: string,
  id: string,
): Promise<ResourcePageData> {
  const mode = id === "new" ? "create" : "detail";
  const commonOptions = await loadCommonOptions(actor);

  if (mode === "create") {
    if (["users", "subjects", "classes", "sessions"].includes(section)) {
      assertRole(actor, ["ADMIN", "MANAGER"]);
    } else if (section === "contents") {
      assertRole(actor, ["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"]);
    } else if (section === "reports") {
      assertRole(actor, ["ADMIN", "MANAGER", "TEACHER"]);
    } else if (section === "settings") {
      assertRole(actor, ["ADMIN"]);
    } else {
      throw new AppError("NOT_FOUND");
    }

    return {
      section,
      mode,
      canEdit: true,
      entity: null,
      options: commonOptions,
    };
  }

  if (section === "users") {
    assertRole(actor, ["ADMIN", "MANAGER"]);
    const entity = await getManagedUserDetail(actor, id);
    return {
      section,
      mode,
      canEdit: true,
      entity: toSerializable(entity),
      options: commonOptions,
    };
  }

  if (section === "subjects") {
    assertRole(actor, ["ADMIN", "MANAGER"]);
    const entity = await prisma.subject.findUnique({
      where: { id },
      include: {
        classes: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            academicYear: true,
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        _count: { select: { classes: true } },
      },
    });
    if (!entity) throw new AppError("NOT_FOUND");
    return {
      section,
      mode,
      canEdit: true,
      entity: toSerializable(entity),
      options: commonOptions,
    };
  }

  if (section === "classes") {
    assertRole(actor, ["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"]);
    await assertClassAccess(actor, id);
    const entity = await prisma.courseClass.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, code: true, name: true } },
        teachers: {
          where: { status: "ACTIVE" },
          include: {
            teacher: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { assignedAt: "asc" },
        },
        assistants: {
          where: { status: "ACTIVE" },
          include: {
            assistant: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
          orderBy: { assignedAt: "asc" },
        },
        students: {
          where: { status: "ACTIVE" },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                profile: { select: { studentCode: true } },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        sessions: {
          select: {
            id: true,
            sessionNumber: true,
            title: true,
            startAt: true,
            status: true,
          },
          orderBy: { sessionNumber: "asc" },
        },
        _count: {
          select: {
            students: { where: { status: "ACTIVE" } },
            sessions: true,
            contents: true,
          },
        },
      },
    });
    if (!entity) throw new AppError("NOT_FOUND");
    return {
      section,
      mode,
      canEdit: actor.role === "ADMIN" || actor.role === "MANAGER",
      entity: toSerializable(entity),
      options: commonOptions,
    };
  }

  if (section === "sessions") {
    const entity = await getAccessibleSessionDetail(actor, id);
    return {
      section,
      mode,
      canEdit: actor.role === "ADMIN" || actor.role === "MANAGER",
      entity: toSerializable(entity),
      options: commonOptions,
    };
  }

  if (section === "contents") {
    assertRole(actor, ["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"]);
    const entity = await getContentDetail(actor, id);
    return {
      section,
      mode,
      canEdit: true,
      entity: toSerializable(entity),
      options: commonOptions,
    };
  }

  if (section === "attendance") {
    assertRole(actor, ["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"]);
    const classSession = await prisma.classSession.findUnique({
      where: { id },
      select: {
        id: true,
        classId: true,
        sessionNumber: true,
        title: true,
        startAt: true,
        endAt: true,
        status: true,
        attendanceOpen: true,
        courseClass: {
          select: {
            id: true,
            code: true,
            name: true,
            students: {
              where: { status: "ACTIVE" },
              select: {
                student: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    profile: { select: { studentCode: true } },
                    attendanceRecords: {
                      where: { classSessionId: id },
                      select: {
                        id: true,
                        status: true,
                        source: true,
                        markedAt: true,
                        note: true,
                      },
                    },
                  },
                },
              },
              orderBy: { student: { name: "asc" } },
            },
          },
        },
      },
    });
    if (!classSession) throw new AppError("NOT_FOUND");
    await assertStaffClassAccess(actor, classSession.classId);
    return {
      section,
      mode,
      canEdit: true,
      entity: toSerializable(classSession),
      options: EMPTY_OPTIONS,
    };
  }

  if (section === "grading") {
    assertRole(actor, ["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"]);
    if (id.startsWith("quiz-")) {
      const attemptId = id.slice("quiz-".length);
      const entity = await prisma.quizAttempt.findUnique({
        where: { id: attemptId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              profile: { select: { studentCode: true } },
            },
          },
          quiz: {
            include: {
              content: {
                select: {
                  id: true,
                  classId: true,
                  title: true,
                  courseClass: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
              questions: {
                orderBy: { order: "asc" },
                include: { choices: { orderBy: { order: "asc" } } },
              },
            },
          },
          answers: {
            include: { question: { select: { id: true, order: true } } },
          },
        },
      });
      if (!entity) throw new AppError("NOT_FOUND");
      await assertStaffClassAccess(actor, entity.quiz.content.classId);
      return {
        section,
        mode,
        canEdit: true,
        entity: toSerializable({
          gradingKind: "QUIZ" as const,
          ...entity,
        }),
        options: EMPTY_OPTIONS,
      };
    }

    const entity = await prisma.submission.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: { select: { studentCode: true } },
          },
        },
        assignment: {
          include: {
            content: {
              select: {
                id: true,
                classId: true,
                title: true,
                courseClass: { select: { id: true, code: true, name: true } },
              },
            },
            questions: {
              orderBy: { order: "asc" },
              include: { choices: { orderBy: { order: "asc" } } },
            },
          },
        },
        answers: {
          include: { question: { select: { id: true, order: true } } },
        },
        files: {
          include: {
            asset: {
              select: {
                id: true,
                originalName: true,
                mimeType: true,
                sizeBytes: true,
              },
            },
          },
        },
      },
    });
    if (!entity) throw new AppError("NOT_FOUND");
    await assertStaffClassAccess(actor, entity.assignment.content.classId);
    return {
      section,
      mode,
      canEdit: true,
      entity: toSerializable({
        gradingKind: "ASSIGNMENT" as const,
        ...entity,
      }),
      options: EMPTY_OPTIONS,
    };
  }

  if (section === "reports") {
    assertRole(actor, ["ADMIN", "MANAGER", "TEACHER"]);
    const entity = await prisma.report.findFirst({
      where: {
        id,
        ...(actor.role === "TEACHER" ? { requestedById: actor.id } : {}),
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        job: true,
        fileAsset: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });
    if (!entity) throw new AppError("NOT_FOUND");
    return {
      section,
      mode,
      canEdit: false,
      entity: toSerializable(entity),
      options: commonOptions,
    };
  }

  if (section === "jobs") {
    assertRole(actor, ["ADMIN", "MANAGER"]);
    const entity = await prisma.job.findUnique({
      where: { id },
      include: {
        reports: {
          select: { id: true, type: true, status: true, createdAt: true },
        },
      },
    });
    if (!entity) throw new AppError("NOT_FOUND");
    return {
      section,
      mode,
      canEdit: entity.status === "FAILED",
      entity: toSerializable(entity),
      options: EMPTY_OPTIONS,
    };
  }

  if (section === "audit") {
    assertRole(actor, ["ADMIN", "MANAGER"]);
    const entity = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!entity) throw new AppError("NOT_FOUND");
    return {
      section,
      mode,
      canEdit: false,
      entity: toSerializable(entity),
      options: EMPTY_OPTIONS,
    };
  }

  if (section === "settings") {
    assertRole(actor, ["ADMIN"]);
    const entity = await prisma.systemSetting.findUnique({
      where: { key: decodeURIComponent(id) },
      include: {
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!entity) throw new AppError("NOT_FOUND");
    return {
      section,
      mode,
      canEdit: true,
      entity: toSerializable(entity),
      options: EMPTY_OPTIONS,
    };
  }

  throw new AppError("NOT_FOUND");
}
