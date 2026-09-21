import { env } from "@/config/env";
import { disconnectDatabase, prisma } from "@/lib/database/client";
import type { UserRole } from "@/generated/prisma/enums";

type DemoUser = {
  email: string;
  name: string;
  role: UserRole;
  codeField?: "studentCode" | "teacherCode" | "assistantCode" | "parentCode";
  code?: string;
};

async function upsertUser(user: DemoUser) {
  const saved = await prisma.user.upsert({
    where: { email: user.email.toLowerCase() },
    create: {
      email: user.email.toLowerCase(),
      emailVerified: true,
      name: user.name,
      role: user.role,
      status: "ACTIVE",
    },
    update: {
      emailVerified: true,
      name: user.name,
      role: user.role,
      status: "ACTIVE",
      lockedAt: null,
      deletedAt: null,
    },
  });

  if (user.codeField && user.code) {
    await prisma.profile.upsert({
      where: { userId: saved.id },
      create: { userId: saved.id, [user.codeField]: user.code },
      update: { [user.codeField]: user.code },
    });
  }
  return saved;
}

async function seedDemo(adminId: string) {
  const demoUsers: DemoUser[] = [
    {
      email: "manager.demo@example.com",
      name: "Nguyễn Minh Quản",
      role: "MANAGER",
    },
    {
      email: "teacher.demo@example.com",
      name: "Trần Thu Hà",
      role: "TEACHER",
      codeField: "teacherCode",
      code: "GV-DEMO-01",
    },
    {
      email: "assistant.demo@example.com",
      name: "Lê Anh Khoa",
      role: "TEACHING_ASSISTANT",
      codeField: "assistantCode",
      code: "TG-DEMO-01",
    },
    {
      email: "student.demo@example.com",
      name: "Phạm Gia Huy",
      role: "STUDENT",
      codeField: "studentCode",
      code: "HS-DEMO-01",
    },
    {
      email: "parent.demo@example.com",
      name: "Phạm Ngọc Lan",
      role: "PARENT",
      codeField: "parentCode",
      code: "PH-DEMO-01",
    },
  ];
  const [manager, teacher, assistant, student, parent] = await Promise.all(
    demoUsers.map(upsertUser),
  );

  const subject = await prisma.subject.upsert({
    where: { code: "TOAN" },
    create: {
      code: "TOAN",
      name: "Toán học",
      description: "Dữ liệu minh họa cho môi trường phát triển.",
    },
    update: { name: "Toán học", isActive: true },
  });

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setUTCMonth(endDate.getUTCMonth() + 3);

  const courseClass = await prisma.courseClass.upsert({
    where: { code: "TOAN-DEMO-01" },
    create: {
      code: "TOAN-DEMO-01",
      name: "Toán nền tảng",
      subjectId: subject.id,
      academicYear: `${startDate.getUTCFullYear()}-${startDate.getUTCFullYear() + 1}`,
      startDate,
      endDate,
      mode: "HYBRID",
      capacity: 30,
      status: "ACTIVE",
      description: "Lớp mẫu chỉ dùng trong môi trường phát triển.",
      createdById: adminId,
    },
    update: {
      subjectId: subject.id,
      status: "ACTIVE",
      createdById: adminId,
    },
  });

  await Promise.all([
    prisma.classTeacher.upsert({
      where: {
        classId_teacherId: {
          classId: courseClass.id,
          teacherId: teacher.id,
        },
      },
      create: {
        classId: courseClass.id,
        teacherId: teacher.id,
        type: "PRIMARY",
      },
      update: { status: "ACTIVE", type: "PRIMARY", removedAt: null },
    }),
    prisma.classAssistant.upsert({
      where: {
        classId_assistantId: {
          classId: courseClass.id,
          assistantId: assistant.id,
        },
      },
      create: {
        classId: courseClass.id,
        assistantId: assistant.id,
      },
      update: { status: "ACTIVE", removedAt: null },
    }),
    prisma.classStudent.upsert({
      where: {
        classId_studentId: {
          classId: courseClass.id,
          studentId: student.id,
        },
      },
      create: { classId: courseClass.id, studentId: student.id },
      update: { status: "ACTIVE", leftAt: null },
    }),
    prisma.parentStudentLink.upsert({
      where: {
        parentId_studentId: {
          parentId: parent.id,
          studentId: student.id,
        },
      },
      create: {
        parentId: parent.id,
        studentId: student.id,
        isPrimary: true,
        reason: "Dữ liệu mẫu môi trường phát triển.",
      },
      update: {
        status: "ACTIVE",
        isPrimary: true,
        unlinkedAt: null,
      },
    }),
    prisma.permissionGrant.upsert({
      where: { id: "00000000-0000-4000-8000-000000000101" },
      create: {
        id: "00000000-0000-4000-8000-000000000101",
        userId: manager.id,
        permission: "OVERRIDE_CLASS_CAPACITY",
        reason: "Quyền mẫu môi trường phát triển.",
        grantedById: adminId,
      },
      update: { revokedAt: null },
    }),
  ]);

  const sessionStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  sessionStart.setMinutes(0, 0, 0);
  const sessionEnd = new Date(sessionStart.getTime() + 90 * 60 * 1000);
  const classSession = await prisma.classSession.upsert({
    where: {
      classId_sessionNumber: {
        classId: courseClass.id,
        sessionNumber: 1,
      },
    },
    create: {
      classId: courseClass.id,
      sessionNumber: 1,
      title: "Khởi động và ôn tập",
      plannedContent: "Ôn kiến thức nền và đánh giá đầu vào.",
      startAt: sessionStart,
      endAt: sessionEnd,
      mode: "ONLINE",
      meetingUrl: "https://meet.google.com/replace-before-use",
      createdById: adminId,
    },
    update: {
      title: "Khởi động và ôn tập",
      createdById: adminId,
    },
  });

  const existingContent = await prisma.content.findFirst({
    where: {
      classSessionId: classSession.id,
      type: "LESSON",
      title: "Hướng dẫn bắt đầu",
      version: 1,
    },
    select: { id: true },
  });
  if (!existingContent) {
    await prisma.content.create({
      data: {
        classId: courseClass.id,
        classSessionId: classSession.id,
        creatorId: teacher.id,
        creatorRole: "TEACHER",
        type: "LESSON",
        title: "Hướng dẫn bắt đầu",
        description: "Bài học mẫu ở định dạng Markdown.",
        publicationStatus: "PUBLISHED",
        approvedById: teacher.id,
        approvedAt: new Date(),
        publishedById: adminId,
        publishedAt: new Date(),
        lockedAt: new Date(),
        lesson: {
          create: {
            markdownContent:
              "# Chào mừng\n\nĐây là nội dung mẫu. Hãy thay thế trước khi vận hành.",
            learningObjectives: [
              "Làm quen với không gian học tập",
              "Biết cách truy cập nội dung theo buổi",
            ],
          },
        },
      },
    });
  }
}

async function ensureAdmin() {
  const email =
    env.SEED_ADMIN_EMAIL
      .trim()
      .toLowerCase();

  const existing =
    await prisma.user.findUnique({
      where: { email },
    });

  if (existing) {
    console.info(
      `Admin đã tồn tại: ${existing.email}. Bỏ qua tạo mới.`,
    );

    return existing;
  }

  const admin =
    await prisma.user.create({
      data: {
        email,
        emailVerified: true,
        name: env.SEED_ADMIN_NAME,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

  console.info(
    `Đã tạo admin ban đầu: ${admin.email}`,
  );

  return admin;
}

async function main() {
  // const admin = await upsertUser({
  //   email: env.SEED_ADMIN_EMAIL,
  //   name: env.SEED_ADMIN_NAME,
  //   role: "ADMIN",
  // });
  const admin = await ensureAdmin();

  if (env.SEED_DEMO) {
    if (env.NODE_ENV === "production") {
      throw new Error("SEED_DEMO không được phép trong production.");
    }
    await seedDemo(admin.id);
  }

  console.info(
    `Seed hoàn tất. Admin: ${admin.email}; demo: ${env.SEED_DEMO ? "có" : "không"}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
