"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionDialogs } from "@/components/ui/action-dialogs";
import { Download, Play, Save, Send } from "lucide-react";

import type { ResourceOption } from "@/modules/dashboard/resource-data";

import {
  apiRequest,
  BusyLabel,
  DANGER_BUTTON,
  Field,
  INPUT_CLASS,
  jsonRequest,
  MutationNotice,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SectionCard,
  TEXTAREA_CLASS,
} from "./admin-ui";

type AttendanceSession = {
  id: string;
  sessionNumber: number;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  attendanceOpen: boolean;
  courseClass: {
    id: string;
    code: string;
    name: string;
    students: Array<{
      student: {
        id: string;
        name: string;
        email: string;
        profile?: { studentCode?: string | null } | null;
        attendanceRecords: Array<{
          id: string;
          status: string;
          source: string;
          markedAt?: string | null;
          note?: string | null;
        }>;
      };
    }>;
  };
};

type GradingSubmission = {
  gradingKind: "ASSIGNMENT";
  id: string;
  status: string;
  submittedAt?: string | null;
  autoScore?: string | number | null;
  manualScore?: string | number | null;
  finalScore?: string | number | null;
  teacherFeedback?: string | null;
  assistantSuggestedScore?: string | number | null;
  assistantSuggestedFeedback?: string | null;
  publishedAt?: string | null;
  student: {
    id: string;
    name: string;
    email: string;
    profile?: { studentCode?: string | null } | null;
  };
  assignment: {
    maxScore: string | number;
    content: {
      id: string;
      title: string;
      courseClass: { id: string; code: string; name: string };
    };
    questions: Array<{
      id: string;
      order: number;
      type: string;
      content: string;
      score: string | number;
      explanation?: string | null;
      choices: Array<{ id: string; content: string; isCorrect: boolean }>;
    }>;
  };
  answers: Array<{
    id: string;
    questionId: string;
    answerText?: string | null;
    selectedChoiceIds?: string[] | null;
    autoScore?: string | number | null;
    manualScore?: string | number | null;
    feedback?: string | null;
  }>;
  files: Array<{
    asset: {
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: string;
    };
  }>;
};

type QuizGradingAttempt = {
  gradingKind: "QUIZ";
  id: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string | null;
  autoScore?: string | number | null;
  manualScore?: string | number | null;
  finalScore?: string | number | null;
  assistantSuggestedScore?: string | number | null;
  publishedAt?: string | null;
  student: {
    id: string;
    name: string;
    email: string;
    profile?: { studentCode?: string | null } | null;
  };
  quiz: {
    maxScore: string | number;
    content: {
      id: string;
      title: string;
      courseClass: { id: string; code: string; name: string };
    };
    questions: Array<{
      id: string;
      order: number;
      type: string;
      content: string;
      score: string | number;
      explanation?: string | null;
      choices: Array<{ id: string; content: string; isCorrect: boolean }>;
    }>;
  };
  answers: Array<{
    id: string;
    questionId: string;
    answerText?: string | null;
    selectedChoiceIds?: string[] | null;
    autoScore?: string | number | null;
    manualScore?: string | number | null;
    feedback?: string | null;
  }>;
};

type ReportDetail = {
  id: string;
  type: string;
  status: string;
  parameters: unknown;
  errorMessage?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string; email: string };
  fileAsset?: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: string;
  } | null;
  job?: {
    id: string;
    status: string;
    attempts: number;
    errorMessage?: string | null;
  } | null;
};

type JobDetail = {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  payload: unknown;
  result?: unknown;
  errorMessage?: string | null;
  scheduledAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  reports?: Array<{ id: string; type: string; status: string }>;
};

type AuditDetail = {
  id: string;
  action: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string; role: string } | null;
};

type SettingDetail = {
  key: string;
  value: unknown;
  description?: string | null;
  updatedAt: string;
  updatedBy?: { id: string; name: string; email: string } | null;
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[32rem] overflow-auto rounded-xl bg-[#172033] p-4 text-xs leading-6 text-slate-100">
      {JSON.stringify(value, null, 2) ?? "null"}
    </pre>
  );
}

export function AttendanceEditor({ entity }: { entity: unknown }) {
  const router = useRouter();
  const session = entity as AttendanceSession;
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();

  async function mark(
    event: React.FormEvent<HTMLFormElement>,
    studentId: string,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusyId(studentId);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/sessions/${session.id}/attendance`, {
        method: "PATCH",
        ...jsonRequest({
          studentId,
          status: String(formData.get("status") ?? ""),
          note: String(formData.get("note") ?? "").trim() || null,
          reason: String(formData.get("reason") ?? ""),
        }),
      });
      setNotice({ message: "Đã cập nhật điểm danh.", tone: "success" });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể điểm danh.",
        tone: "error",
      });
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard title="Thông tin buổi điểm danh">
        <p className="font-semibold text-[#172033]">
          {session.courseClass.code} · Buổi {session.sessionNumber}:{" "}
          {session.title}
        </p>
        <p className="mt-2 text-sm text-[#667085]">
          {new Date(session.startAt).toLocaleString("vi-VN")} · {session.status}{" "}
          · {session.attendanceOpen ? "Đang mở điểm danh" : "Đã đóng điểm danh"}
        </p>
      </SectionCard>
      <SectionCard
        title={`Danh sách học sinh (${session.courseClass.students.length})`}
        description="Học sinh chưa có bản ghi sẽ hiển thị ở trạng thái Chờ; lưu sẽ tạo bản ghi điểm danh."
        id="edit"
      >
        <div className="space-y-4">
          {session.courseClass.students.map(({ student }) => {
            const record = student.attendanceRecords[0];
            return (
              <form
                key={student.id}
                onSubmit={(event) => mark(event, student.id)}
                className="grid gap-4 rounded-xl border border-[#E4E7EC] p-4 lg:grid-cols-[minmax(180px,1fr)_160px_1fr_1fr_auto] lg:items-end"
              >
                <div>
                  <p className="font-semibold">{student.name}</p>
                  <p className="mt-1 text-xs text-[#667085]">
                    {student.profile?.studentCode ?? "Chưa có mã"} ·{" "}
                    {student.email}
                  </p>
                </div>
                <Field label="Trạng thái">
                  <select
                    name="status"
                    defaultValue={record?.status ?? "PENDING"}
                    className={INPUT_CLASS}
                  >
                    <option value="PENDING">Chờ</option>
                    <option value="PRESENT">Có mặt</option>
                    <option value="LATE">Đi trễ</option>
                    <option value="ABSENT">Vắng</option>
                    <option value="EXCUSED">Vắng có phép</option>
                  </select>
                </Field>
                <Field label="Ghi chú">
                  <input
                    name="note"
                    defaultValue={record?.note ?? ""}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Lý do điều chỉnh" required>
                  <input
                    name="reason"
                    required
                    minLength={3}
                    className={INPUT_CLASS}
                  />
                </Field>
                <button disabled={Boolean(busyId)} className={PRIMARY_BUTTON}>
                  <Save className="mr-2 size-4" />
                  {busyId === student.id ? "Đang lưu…" : "Lưu"}
                </button>
              </form>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function AssignmentGradingEditor({
  entity,
  actorRole,
}: {
  entity: unknown;
  actorRole: string;
}) {
  const router = useRouter();
  const { requestReason } = useActionDialogs();
  const submission = entity as GradingSubmission;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();
  const answerByQuestion = new Map(
    submission.answers.map((answer) => [answer.questionId, answer]),
  );
  const assistant = actorRole === "TEACHING_ASSISTANT";

  async function grade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/submissions/${submission.id}/grade`, {
        method: "PATCH",
        ...jsonRequest({
          action: assistant ? "SUGGEST" : "GRADE",
          score: Number(formData.get("score")),
          feedback: String(formData.get("feedback") ?? "").trim() || undefined,
          reason: String(formData.get("reason") ?? ""),
        }),
      });
      setNotice({
        message: assistant ? "Đã lưu điểm đề xuất." : "Đã chấm bài.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không thể chấm bài.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function operation(
    action: "PUBLISH" | "RETURN" | "REQUIRE_RESUBMISSION",
  ) {
    const reason = await requestReason({
      title:
        action === "PUBLISH"
          ? "Công bố điểm"
          : action === "RETURN"
            ? "Trả bài"
            : "Yêu cầu nộp lại",
      confirmLabel:
        action === "PUBLISH"
          ? "Công bố"
          : action === "RETURN"
            ? "Trả bài"
            : "Yêu cầu nộp lại",
      danger: action === "REQUIRE_RESUBMISSION",
    });
    if (!reason) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/submissions/${submission.id}/grade`, {
        method: "PATCH",
        ...jsonRequest({ action, reason }),
      });
      setNotice({
        message: "Đã cập nhật trạng thái bài nộp.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không thể cập nhật.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard title="Bài nộp">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[#667085]">Học sinh</p>
            <p className="mt-1 font-semibold">{submission.student.name}</p>
          </div>
          <div>
            <p className="text-[#667085]">Lớp</p>
            <p className="mt-1 font-semibold">
              {submission.assignment.content.courseClass.code}
            </p>
          </div>
          <div>
            <p className="text-[#667085]">Bài tập</p>
            <p className="mt-1 font-semibold">
              {submission.assignment.content.title}
            </p>
          </div>
          <div>
            <p className="text-[#667085]">Trạng thái</p>
            <p className="mt-1 font-semibold">{submission.status}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Câu trả lời">
        <div className="space-y-4">
          {submission.assignment.questions.map((question) => {
            const answer = answerByQuestion.get(question.id);
            const selected = new Set(answer?.selectedChoiceIds ?? []);
            return (
              <article
                key={question.id}
                className="rounded-xl border border-[#E4E7EC] p-4"
              >
                <p className="text-sm font-semibold">
                  Câu {question.order} ({question.score} điểm) · {question.type}
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-[#344054]">
                  {question.content}
                </p>
                {question.choices.length ? (
                  <div className="mt-3 space-y-2">
                    {question.choices.map((choice) => (
                      <p
                        key={choice.id}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          selected.has(choice.id)
                            ? "bg-blue-50 text-blue-800"
                            : "bg-[#F9FAFB] text-[#475467]"
                        }`}
                      >
                        {selected.has(choice.id) ? "✓ " : ""}
                        {choice.content}
                        {choice.isCorrect ? " · Đáp án đúng" : ""}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-[#F9FAFB] p-3 text-sm whitespace-pre-wrap">
                    {answer?.answerText || "Chưa có câu trả lời."}
                  </p>
                )}
                <p className="mt-3 text-xs text-[#667085]">
                  Điểm tự động: {answer?.autoScore ?? "—"} · Điểm tay:{" "}
                  {answer?.manualScore ?? "—"}
                </p>
              </article>
            );
          })}
        </div>
        {submission.files.length ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {submission.files.map(({ asset }) => (
              <Link
                key={asset.id}
                href={`/api/v1/assets/${asset.id}/download`}
                className={SECONDARY_BUTTON}
              >
                <Download className="mr-2 size-4" />
                {asset.originalName}
              </Link>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title={assistant ? "Đề xuất điểm" : "Chấm điểm"} id="edit">
        <form onSubmit={grade} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={`Điểm (tối đa ${submission.assignment.maxScore})`}
              required
            >
              <input
                type="number"
                name="score"
                min={0}
                max={Number(submission.assignment.maxScore)}
                step="0.25"
                defaultValue={
                  assistant
                    ? (submission.assistantSuggestedScore ?? "")
                    : (submission.finalScore ?? submission.autoScore ?? "")
                }
                required
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Lý do" required>
              <input
                name="reason"
                required
                minLength={3}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <Field label="Nhận xét">
            <textarea
              name="feedback"
              defaultValue={
                assistant
                  ? (submission.assistantSuggestedFeedback ?? "")
                  : (submission.teacherFeedback ?? "")
              }
              className={TEXTAREA_CLASS}
            />
          </Field>
          <div className="flex justify-end">
            <button disabled={busy} className={PRIMARY_BUTTON}>
              <BusyLabel
                busy={busy}
                idle={assistant ? "Lưu đề xuất" : "Lưu điểm"}
              />
            </button>
          </div>
        </form>
        {!assistant ? (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-[#E4E7EC] pt-5">
            <button
              type="button"
              disabled={busy || submission.finalScore == null}
              onClick={() => operation("PUBLISH")}
              className={PRIMARY_BUTTON}
            >
              <Send className="mr-2 size-4" />
              Công bố điểm
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => operation("RETURN")}
              className={SECONDARY_BUTTON}
            >
              Trả bài
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => operation("REQUIRE_RESUBMISSION")}
              className={DANGER_BUTTON}
            >
              Yêu cầu nộp lại
            </button>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function QuizGradingEditor({
  attempt,
  actorRole,
}: {
  attempt: QuizGradingAttempt;
  actorRole: string;
}) {
  const router = useRouter();
  const { requestReason } = useActionDialogs();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();
  const answerByQuestion = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );
  const assistant = actorRole === "TEACHING_ASSISTANT";

  async function grade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/quiz-attempts/${attempt.id}/grade`, {
        method: "PATCH",
        ...jsonRequest({
          action: assistant ? "SUGGEST" : "GRADE",
          score: Number(formData.get("score")),
          reason: String(formData.get("reason") ?? ""),
        }),
      });
      setNotice({
        message: assistant ? "Đã lưu điểm đề xuất." : "Đã chấm bài kiểm tra.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Không thể chấm bài kiểm tra.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    const reason = await requestReason({
      title: "Công bố điểm bài kiểm tra",
      description: "Sau khi công bố, học sinh/phụ huynh có thể xem kết quả theo chính sách hiện tại.",
      confirmLabel: "Công bố điểm",
    });
    if (!reason) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/quiz-attempts/${attempt.id}/grade`, {
        method: "PATCH",
        ...jsonRequest({ action: "PUBLISH", reason }),
      });
      setNotice({ message: "Đã công bố điểm bài kiểm tra.", tone: "success" });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể công bố điểm.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard title="Lượt làm bài kiểm tra">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[#667085]">Học sinh</p>
            <p className="mt-1 font-semibold">{attempt.student.name}</p>
          </div>
          <div>
            <p className="text-[#667085]">Lớp</p>
            <p className="mt-1 font-semibold">
              {attempt.quiz.content.courseClass.code}
            </p>
          </div>
          <div>
            <p className="text-[#667085]">Bài kiểm tra</p>
            <p className="mt-1 font-semibold">{attempt.quiz.content.title}</p>
          </div>
          <div>
            <p className="text-[#667085]">Lần làm / trạng thái</p>
            <p className="mt-1 font-semibold">
              Lần {attempt.attemptNumber} · {attempt.status}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Câu trả lời">
        <div className="space-y-4">
          {attempt.quiz.questions.map((question) => {
            const answer = answerByQuestion.get(question.id);
            const selected = new Set(
              Array.isArray(answer?.selectedChoiceIds)
                ? answer.selectedChoiceIds
                : [],
            );
            return (
              <article
                key={question.id}
                className="rounded-xl border border-[#E4E7EC] p-4"
              >
                <p className="text-sm font-semibold">
                  Câu {question.order} ({question.score} điểm) · {question.type}
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap text-[#344054]">
                  {question.content}
                </p>
                {question.choices.length ? (
                  <div className="mt-3 space-y-2">
                    {question.choices.map((choice) => (
                      <p
                        key={choice.id}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          selected.has(choice.id)
                            ? "bg-blue-50 text-blue-800"
                            : "bg-[#F9FAFB] text-[#475467]"
                        }`}
                      >
                        {selected.has(choice.id) ? "✓ Học sinh chọn · " : ""}
                        {choice.content}
                        {choice.isCorrect ? " · Đáp án đúng" : ""}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-lg bg-[#F9FAFB] p-3 text-sm whitespace-pre-wrap">
                    {answer?.answerText || "Chưa có câu trả lời."}
                  </p>
                )}
                <p className="mt-3 text-xs text-[#667085]">
                  Điểm tự động: {answer?.autoScore ?? "—"} · Điểm tay:{" "}
                  {answer?.manualScore ?? "—"}
                </p>
                {question.explanation ? (
                  <p className="mt-2 text-xs text-[#667085]">
                    Giải thích: {question.explanation}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title={assistant ? "Đề xuất điểm quiz" : "Chấm điểm quiz"}
        id="edit"
      >
        <form onSubmit={grade} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Điểm (tối đa ${attempt.quiz.maxScore})`} required>
              <input
                type="number"
                name="score"
                min={0}
                max={Number(attempt.quiz.maxScore)}
                step="0.25"
                defaultValue={
                  assistant
                    ? (attempt.assistantSuggestedScore ?? "")
                    : (attempt.finalScore ?? attempt.autoScore ?? "")
                }
                required
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Lý do" required>
              <input
                name="reason"
                required
                minLength={3}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              disabled={busy || Boolean(attempt.publishedAt)}
              className={PRIMARY_BUTTON}
            >
              <BusyLabel
                busy={busy}
                idle={assistant ? "Lưu đề xuất" : "Lưu điểm"}
              />
            </button>
            {!assistant ? (
              <button
                type="button"
                disabled={
                  busy ||
                  attempt.finalScore == null ||
                  Boolean(attempt.publishedAt)
                }
                onClick={publish}
                className={SECONDARY_BUTTON}
              >
                <Send className="mr-2 size-4" />
                {attempt.publishedAt ? "Đã công bố" : "Công bố điểm"}
              </button>
            ) : null}
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

export function GradingEditor({
  entity,
  actorRole,
}: {
  entity: unknown;
  actorRole: string;
}) {
  const grading = entity as GradingSubmission | QuizGradingAttempt;
  return grading.gradingKind === "QUIZ" ? (
    <QuizGradingEditor attempt={grading} actorRole={actorRole} />
  ) : (
    <AssignmentGradingEditor entity={grading} actorRole={actorRole} />
  );
}

const REPORT_TYPES = [
  "USERS",
  "CLASSES",
  "CAPACITY",
  "ATTENDANCE",
  "ASSIGNMENTS",
  "QUIZZES",
  "PROGRESS",
  "VIDEO",
  "STORAGE",
  "FAILED_JOBS",
] as const;

export function ReportEditor({
  mode,
  entity,
  classes,
  actorRole,
}: {
  mode: "create" | "detail";
  entity: unknown;
  classes: ResourceOption[];
  actorRole: string;
}) {
  const router = useRouter();
  const report = entity as ReportDetail | null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();
  const types =
    actorRole === "TEACHER"
      ? REPORT_TYPES.filter((type) =>
          [
            "ATTENDANCE",
            "ASSIGNMENTS",
            "QUIZZES",
            "PROGRESS",
            "VIDEO",
          ].includes(type),
        )
      : REPORT_TYPES;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(undefined);
    try {
      const created = await apiRequest<{ id: string }>("/api/v1/reports", {
        method: "POST",
        ...jsonRequest({
          type: String(formData.get("type") ?? ""),
          parameters: {
            classId: String(formData.get("classId") ?? "").trim() || undefined,
            from: String(formData.get("from") ?? "").trim() || undefined,
            to: String(formData.get("to") ?? "").trim() || undefined,
          },
        }),
      });
      router.push(`/dashboard/reports/${created.id}`);
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể tạo báo cáo.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (mode === "create") {
    return (
      <SectionCard
        title="Tạo báo cáo"
        description="Báo cáo được xử lý bởi worker và xuất tệp tải xuống có kiểm quyền."
        id="edit"
      >
        <form onSubmit={create} className="space-y-5">
          <MutationNotice {...notice} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Loại báo cáo" required>
              <select name="type" required className={INPUT_CLASS}>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lớp học" required={actorRole === "TEACHER"}>
              <select
                name="classId"
                required={actorRole === "TEACHER"}
                className={INPUT_CLASS}
              >
                <option value="">Toàn hệ thống / không giới hạn lớp</option>
                {classes.map((courseClass) => (
                  <option key={courseClass.id} value={courseClass.id}>
                    {courseClass.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Từ ngày">
              <input type="date" name="from" className={INPUT_CLASS} />
            </Field>
            <Field label="Đến ngày">
              <input type="date" name="to" className={INPUT_CLASS} />
            </Field>
          </div>
          <div className="flex justify-end">
            <button disabled={busy} className={PRIMARY_BUTTON}>
              <BusyLabel busy={busy} idle="Tạo báo cáo" />
            </button>
          </div>
        </form>
      </SectionCard>
    );
  }

  if (!report) return null;
  return (
    <div className="space-y-5">
      <SectionCard title="Chi tiết báo cáo">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[#667085]">Loại</dt>
            <dd className="mt-1 font-semibold">{report.type}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Trạng thái</dt>
            <dd className="mt-1 font-semibold">{report.status}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Người yêu cầu</dt>
            <dd className="mt-1 font-semibold">{report.requestedBy.name}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Tạo lúc</dt>
            <dd className="mt-1 font-semibold">
              {new Date(report.createdAt).toLocaleString("vi-VN")}
            </dd>
          </div>
        </dl>
        {report.errorMessage ? (
          <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {report.errorMessage}
          </p>
        ) : null}
        {report.fileAsset ? (
          <Link
            href={`/api/v1/assets/${report.fileAsset.id}/download`}
            className={`${PRIMARY_BUTTON} mt-5`}
          >
            <Download className="mr-2 size-4" />
            Tải {report.fileAsset.originalName}
          </Link>
        ) : (
          <p className="mt-4 text-sm text-[#667085]">
            Tệp chưa sẵn sàng. Hãy tải lại trang sau khi worker hoàn tất.
          </p>
        )}
      </SectionCard>
      <SectionCard title="Tham số">
        <JsonBlock value={report.parameters} />
      </SectionCard>
    </div>
  );
}

export function JobEditor({ entity }: { entity: unknown }) {
  const router = useRouter();
  const { requestReason } = useActionDialogs();
  const job = entity as JobDetail;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();

  async function retry() {
    const reason = await requestReason({
      title: "Chạy lại job thất bại",
      description: "Job sẽ được đưa lại vào hàng chờ và tăng số lần thử theo chính sách.",
      confirmLabel: "Chạy lại job",
    });
    if (!reason) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/jobs/${job.id}/retry`, {
        method: "POST",
        ...jsonRequest({ reason }),
      });
      setNotice({
        message: "Job đã được đưa lại vào hàng chờ.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể chạy lại job.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard title="Chi tiết job">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[#667085]">Loại</dt>
            <dd className="mt-1 font-semibold">{job.type}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Trạng thái</dt>
            <dd className="mt-1 font-semibold">{job.status}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Số lần thử</dt>
            <dd className="mt-1 font-semibold">
              {job.attempts}/{job.maxAttempts}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Lịch chạy</dt>
            <dd className="mt-1 font-semibold">
              {new Date(job.scheduledAt).toLocaleString("vi-VN")}
            </dd>
          </div>
        </dl>
        {job.errorMessage ? (
          <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm whitespace-pre-wrap text-red-800">
            {job.errorMessage}
          </p>
        ) : null}
        {job.status === "FAILED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={retry}
            className={`${PRIMARY_BUTTON} mt-5`}
          >
            <Play className="mr-2 size-4" />
            <BusyLabel busy={busy} idle="Chạy lại job" />
          </button>
        ) : null}
      </SectionCard>
      <SectionCard title="Payload">
        <JsonBlock value={job.payload} />
      </SectionCard>
      {job.result !== undefined ? (
        <SectionCard title="Kết quả">
          <JsonBlock value={job.result} />
        </SectionCard>
      ) : null}
    </div>
  );
}

export function AuditEditor({ entity }: { entity: unknown }) {
  const log = entity as AuditDetail;
  return (
    <div className="space-y-5">
      <SectionCard title="Chi tiết nhật ký">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[#667085]">Thao tác</dt>
            <dd className="mt-1 font-semibold">{log.action}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Người thực hiện</dt>
            <dd className="mt-1 font-semibold">
              {log.actor?.name ?? `Hệ thống (${log.actorRole})`}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Tài nguyên</dt>
            <dd className="mt-1 font-semibold">
              {log.entityType} · {log.entityId}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Thời gian</dt>
            <dd className="mt-1 font-semibold">
              {new Date(log.createdAt).toLocaleString("vi-VN")}
            </dd>
          </div>
        </dl>
        {log.reason ? (
          <p className="mt-4 rounded-xl bg-[#F2F4F7] p-4 text-sm text-[#475467]">
            Lý do: {log.reason}
          </p>
        ) : null}
      </SectionCard>
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Dữ liệu trước">
          <JsonBlock value={log.oldValue} />
        </SectionCard>
        <SectionCard title="Dữ liệu sau">
          <JsonBlock value={log.newValue} />
        </SectionCard>
      </div>
    </div>
  );
}

export function SettingEditor({
  mode,
  entity,
}: {
  mode: "create" | "detail";
  entity: unknown;
}) {
  const router = useRouter();
  const setting = entity as SettingDetail | null;
  const creating = mode === "create";
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(undefined);
    try {
      let value: unknown;
      try {
        value = JSON.parse(String(formData.get("value") ?? ""));
      } catch {
        throw new Error("Giá trị phải là JSON hợp lệ.");
      }
      const body = {
        ...(!setting ? { key: String(formData.get("key") ?? "") } : {}),
        value,
        description: String(formData.get("description") ?? "").trim() || null,
        reason: String(formData.get("reason") ?? ""),
      };
      if (setting) {
        await apiRequest(
          `/api/v1/settings/${encodeURIComponent(setting.key)}`,
          {
            method: "PATCH",
            ...jsonRequest(body),
          },
        );
        setNotice({ message: "Đã cập nhật cài đặt.", tone: "success" });
        router.refresh();
      } else {
        const created = await apiRequest<{ key: string }>("/api/v1/settings", {
          method: "POST",
          ...jsonRequest(body),
        });
        router.push(`/dashboard/settings/${encodeURIComponent(created.key)}`);
        router.refresh();
      }
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể lưu cài đặt.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      title={creating ? "Thêm cài đặt" : "Chỉnh sửa cài đặt"}
      description="Giá trị được nhập bằng JSON; thay đổi luôn được ghi audit."
      id="edit"
    >
      <form onSubmit={submit} className="space-y-5">
        <MutationNotice {...notice} />
        <Field label="Khóa cài đặt" required>
          <input
            name="key"
            defaultValue={setting?.key ?? ""}
            disabled={Boolean(setting)}
            required
            pattern="[A-Z][A-Z0-9_]*"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Giá trị JSON" required>
          <textarea
            name="value"
            defaultValue={
              setting ? JSON.stringify(setting.value, null, 2) : "{\n  \n}"
            }
            required
            className={`${TEXTAREA_CLASS} min-h-52 font-mono`}
          />
        </Field>
        <Field label="Mô tả">
          <textarea
            name="description"
            defaultValue={setting?.description ?? ""}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="Lý do" required>
          <input name="reason" required minLength={3} className={INPUT_CLASS} />
        </Field>
        <div className="flex justify-end">
          <button disabled={busy} className={PRIMARY_BUTTON}>
            <BusyLabel
              busy={busy}
              idle={setting ? "Lưu cài đặt" : "Thêm cài đặt"}
            />
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
