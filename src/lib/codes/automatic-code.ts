import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";

type Tx = Prisma.TransactionClient;

async function lockCodeSequence(
  tx: Tx,
  key: string,
) {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${key})
    )
  `;
}

function nextCode(
  lastCode: string | null | undefined,
  prefix: string,
  digits = 6,
) {
  const current =
    lastCode &&
    lastCode.startsWith(prefix)
      ? Number(
          lastCode.slice(prefix.length),
        )
      : 0;

  return `${prefix}${String(
    Number.isFinite(current)
      ? current + 1
      : 1,
  ).padStart(digits, "0")}`;
}

export async function generateProfileCode(
  tx: Tx,
  role: UserRole,
) {
  switch (role) {
    case "STUDENT": {
      const prefix = "HS";

      await lockCodeSequence(
        tx,
        "profile-code:student",
      );

      const last =
        await tx.profile.findFirst({
          where: {
            studentCode: {
              startsWith: prefix,
            },
          },
          orderBy: {
            studentCode: "desc",
          },
          select: {
            studentCode: true,
          },
        });

      return {
        studentCode: nextCode(
          last?.studentCode,
          prefix,
        ),
      };
    }

    case "TEACHER": {
      const prefix = "GV";

      await lockCodeSequence(
        tx,
        "profile-code:teacher",
      );

      const last =
        await tx.profile.findFirst({
          where: {
            teacherCode: {
              startsWith: prefix,
            },
          },
          orderBy: {
            teacherCode: "desc",
          },
          select: {
            teacherCode: true,
          },
        });

      return {
        teacherCode: nextCode(
          last?.teacherCode,
          prefix,
        ),
      };
    }

    case "TEACHING_ASSISTANT": {
      const prefix = "TG";

      await lockCodeSequence(
        tx,
        "profile-code:assistant",
      );

      const last =
        await tx.profile.findFirst({
          where: {
            assistantCode: {
              startsWith: prefix,
            },
          },
          orderBy: {
            assistantCode: "desc",
          },
          select: {
            assistantCode: true,
          },
        });

      return {
        assistantCode: nextCode(
          last?.assistantCode,
          prefix,
        ),
      };
    }

    case "PARENT": {
      const prefix = "PH";

      await lockCodeSequence(
        tx,
        "profile-code:parent",
      );

      const last =
        await tx.profile.findFirst({
          where: {
            parentCode: {
              startsWith: prefix,
            },
          },
          orderBy: {
            parentCode: "desc",
          },
          select: {
            parentCode: true,
          },
        });

      return {
        parentCode: nextCode(
          last?.parentCode,
          prefix,
        ),
      };
    }

    default:
      return {};
  }
}

function academicYearCode(
  academicYear: string,
) {
  const years =
    academicYear.match(/\d{4}/g);

  if (
    years &&
    years.length >= 2
  ) {
    return (
      years[0].slice(-2) +
      years[1].slice(-2)
    );
  }

  return academicYear
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
}

export async function generateClassCode(
  tx: Tx,
  subjectCode: string,
  academicYear: string,
) {
  const subject =
    subjectCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

  const year =
    academicYearCode(
      academicYear,
    );

  const prefix =
    `${subject}-${year}-`;

  await lockCodeSequence(
    tx,
    `class-code:${prefix}`,
  );

  const last =
    await tx.courseClass.findFirst({
      where: {
        code: {
          startsWith: prefix,
        },
      },
      orderBy: {
        code: "desc",
      },
      select: {
        code: true,
      },
    });

  const lastNumber =
    last?.code
      ? Number(
          last.code.slice(
            prefix.length,
          ),
        )
      : 0;

  const next =
    Number.isFinite(lastNumber)
      ? lastNumber + 1
      : 1;

  return `${prefix}${String(
    next,
  ).padStart(4, "0")}`;
}