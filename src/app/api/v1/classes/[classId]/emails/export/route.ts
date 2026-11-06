import { requireActor } from "@/lib/auth/actor";
import { assertStaffClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { apiError } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getRequestContext } from "@/lib/security/request-context";
import { classContactsCsv, classContactsTxt, collectClassContacts } from "@/modules/classes/class-email-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { classId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classId)) throw new AppError("BAD_REQUEST");
    await assertStaffClassAccess(actor, classId);
    const format = new URL(request.url).searchParams.get("format") ?? "csv";
    if (format !== "csv" && format !== "txt") throw new AppError("BAD_REQUEST");
    const courseClass = await prisma.courseClass.findUnique({
      where: { id: classId },
      select: {
        code: true,
        teachers: { where: { status: "ACTIVE" }, select: { teacher: { select: {
          name: true, email: true, status: true, deletedAt: true, lockedAt: true,
        } } } },
        assistants: { where: { status: "ACTIVE" }, select: { assistant: { select: {
          name: true, email: true, status: true, deletedAt: true, lockedAt: true,
        } } } },
        students: { where: { status: "ACTIVE" }, select: { student: { select: {
          name: true, email: true, status: true, deletedAt: true, lockedAt: true,
          studentParentLinks: { where: { status: "ACTIVE" }, select: { parent: { select: {
            name: true, email: true, status: true, deletedAt: true, lockedAt: true,
          } } } },
        } } } },
      },
    });
    if (!courseClass) throw new AppError("NOT_FOUND");
    type Member = { name: string; email: string; status: string; deletedAt: Date | null; lockedAt: Date | null };
    const members: Array<{ name: string; email: string; role: string }> = [];
    function add(person: Member, role: string) {
      if (person.status === "ACTIVE" && !person.deletedAt && !person.lockedAt) {
        members.push({ name: person.name, email: person.email, role });
      }
    }
    for (const member of courseClass.teachers) add(member.teacher, "Giáo viên");
    for (const member of courseClass.assistants) add(member.assistant, "Trợ giảng");
    for (const member of courseClass.students) {
      const student = member.student;
      if (student.status !== "ACTIVE" || student.deletedAt || student.lockedAt) continue;
      add(student, "Học sinh");
      for (const link of student.studentParentLinks) add(link.parent, "Phụ huynh");
    }
    const contacts = collectClassContacts(members);
    const payload = format === "csv" ? classContactsCsv(contacts) : classContactsTxt(contacts);
    const code = courseClass.code.replace(/[^a-zA-Z0-9_-]/g, "_");
    return new Response(payload, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"emails-lop-" + code + "." + format + "\"",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return apiError(error, context.requestId); }
}
