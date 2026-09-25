"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionDialogs } from "@/components/ui/action-dialogs";
import {
  Archive,
  Check,
  EyeOff,
  FileUp,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react";

import type { ResourceOption } from "@/modules/dashboard/resource-data";

import {
  apiRequest,
  BusyLabel,
  DANGER_BUTTON,
  Field,
  INPUT_CLASS,
  jsonRequest,
  MutationNotice,
  optionalIsoDate,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SectionCard,
  TEXTAREA_CLASS,
  toDateTimeInput,
} from "./admin-ui";

type ContentType = "LESSON" | "MATERIAL" | "VIDEO" | "ASSIGNMENT" | "QUIZ";
type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "SHORT_ANSWER"
  | "ESSAY"
  | "FILE_UPLOAD";

type EditorChoice = {
  key: string;
  content: string;
  isCorrect: boolean;
};

type EditorQuestion = {
  key: string;
  type: QuestionType;
  content: string;
  score: number;
  explanation: string;
  required: boolean;
  choices: EditorChoice[];
};

type ContentPayload = {
  assetId?: string;
  recordingId?: string;
  materialId?: string;
  previewStatus?: string;
  previewError?: string | null;
  processingStatus?: string;
  viewUrl?: string;
  downloadUrl?: string;
  markdownContent?: string;
  learningObjectives?: string[];
  title?: string;
  description?: string | null;
  opensAt?: string | null;
  dueAt?: string | null;
  closesAt?: string | null;
  durationMinutes?: number;
  maxAttempts?: number;
  allowLateSubmission?: boolean;
  shuffleQuestions?: boolean;
  shuffleChoices?: boolean;
  showResultAt?: string | null;
  showCorrectAnswersAt?: string | null;
  maxScore?: string | number;
  questions?: Array<{
    id: string;
    type: QuestionType;
    content: string;
    score: string | number;
    explanation?: string | null;
    required: boolean;
    choices: Array<{
      id: string;
      content: string;
      isCorrect?: boolean;
    }>;
  }>;
};

type ContentDetail = {
  id: string;
  classId: string;
  classSessionId: string;
  creatorId: string;
  creatorRole: string;
  creator: { id: string; name: string; email: string; role: string };
  courseClass: { id: string; code: string; name: string };
  classSession: { id: string; sessionNumber: number; title: string };
  type: ContentType;
  title: string;
  description?: string | null;
  publicationStatus: string;
  version: number;
  previousVersionId?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  payload: ContentPayload;
  reviews?: Array<{
    id: string;
    action: string;
    comment?: string | null;
    createdAt: string;
    reviewer: { id: string; name: string; role: string };
  }>;
};

type WorkflowAction =
  | "SUBMIT_REVIEW"
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "REJECT"
  | "PUBLISH"
  | "REQUEST_REOPEN"
  | "REOPEN"
  | "REJECT_REOPEN"
  | "HIDE"
  | "ARCHIVE";

const TYPE_LABELS: Record<ContentType, string> = {
  LESSON: "Bài học",
  MATERIAL: "Tài liệu",
  VIDEO: "Video",
  ASSIGNMENT: "Bài tập",
  QUIZ: "Bài kiểm tra",
};

const QUESTION_LABELS: Record<QuestionType, string> = {
  SINGLE_CHOICE: "Một đáp án",
  MULTIPLE_CHOICE: "Nhiều đáp án",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Trả lời ngắn",
  ESSAY: "Tự luận",
  FILE_UPLOAD: "Tải file",
};

function localKey() {
  return (
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );
}

function emptyQuestion(quiz: boolean, deterministic = false): EditorQuestion {
  return {
    key: deterministic ? "question-1" : localKey(),
    type: quiz ? "SINGLE_CHOICE" : "SHORT_ANSWER",
    content: "",
    score: 10,
    explanation: "",
    required: true,
    choices: quiz
      ? [
        {
          key: deterministic ? "choice-1" : localKey(),
          content: "",
          isCorrect: true,
        },
        {
          key: deterministic ? "choice-2" : localKey(),
          content: "",
          isCorrect: false,
        },
      ]
      : [],
  };
}

function initialQuestions(content: ContentDetail | null, type: ContentType) {
  const source = content?.payload.questions;
  if (source?.length) {
    return source.map((question) => ({
      key: question.id,
      type: question.type,
      content: question.content,
      score: Number(question.score),
      explanation: question.explanation ?? "",
      required: question.required,
      choices: question.choices.map((choice) => ({
        key: choice.id,
        content: choice.content,
        isCorrect: Boolean(choice.isCorrect),
      })),
    }));
  }
  return type === "ASSIGNMENT" || type === "QUIZ"
    ? [emptyQuestion(type === "QUIZ", true)]
    : [];
}

function cleanHeaderFileName(name: string) {
  return name.replace(/[^\x20-\x7E]/g, "_").slice(0, 255);
}

function availableWorkflowActions(
  actorId: string,
  actorRole: string,
  content: ContentDetail,
): WorkflowAction[] {
  const status = content.publicationStatus;
  const administrator = actorRole === "ADMIN" || actorRole === "MANAGER";
  const creator = actorId === content.creatorId;
  const actions: WorkflowAction[] = [];

  if (administrator) {
    if (status === "PENDING_TEACHER_REVIEW") {
      actions.push("APPROVE", "REQUEST_CHANGES", "REJECT");
    }
    if (
      ["DRAFT", "CHANGES_REQUESTED", "APPROVED", "REOPENED"].includes(status)
    ) {
      actions.push("PUBLISH");
    }
    if (status === "REOPEN_REQUESTED") actions.push("REOPEN", "REJECT_REOPEN");
    if (status === "PUBLISHED") actions.push("HIDE");
    if (!["PUBLISHED", "ARCHIVED"].includes(status)) actions.push("ARCHIVE");
    return actions;
  }

  if (actorRole === "TEACHER") {
    if (
      content.creatorRole === "TEACHING_ASSISTANT" &&
      status === "PENDING_TEACHER_REVIEW"
    ) {
      actions.push("APPROVE", "REQUEST_CHANGES", "REJECT");
    }
    if (
      creator &&
      content.creatorRole === "TEACHER" &&
      ["DRAFT", "CHANGES_REQUESTED", "REOPENED"].includes(status)
    ) {
      actions.push("PUBLISH");
    }
  }

  if (actorRole === "TEACHING_ASSISTANT" && creator) {
    if (["DRAFT", "CHANGES_REQUESTED", "REOPENED"].includes(status)) {
      actions.push("SUBMIT_REVIEW");
    }
    if (status === "APPROVED") actions.push("PUBLISH");
  }

  if (
    creator &&
    ["TEACHER", "TEACHING_ASSISTANT"].includes(actorRole) &&
    status === "PUBLISHED"
  ) {
    actions.push("REQUEST_REOPEN");
  }

  return actions;
}

function actionLabel(action: WorkflowAction) {
  return {
    SUBMIT_REVIEW: "Gửi duyệt",
    APPROVE: "Duyệt",
    REQUEST_CHANGES: "Yêu cầu sửa",
    REJECT: "Từ chối",
    PUBLISH: "Xuất bản",
    REQUEST_REOPEN: "Yêu cầu mở lại",
    REOPEN: "Duyệt mở lại",
    REJECT_REOPEN: "Từ chối mở lại",
    HIDE: "Ẩn nội dung",
    ARCHIVE: "Lưu trữ",
  }[action];
}

export function ContentEditor({
  mode,
  actorId,
  actorRole,
  entity,
  classes,
  sessions,
  defaultType,
  defaultClassId,
}: {
  mode: "create" | "detail";
  actorId: string;
  actorRole: string;
  entity: unknown;
  classes: ResourceOption[];
  sessions: ResourceOption[];
  defaultType?: string;
  defaultClassId?: string;
}) {
  const router = useRouter();
  const {
    requestReason,
    confirmAction,
  } = useActionDialogs();
  const content = entity as ContentDetail | null;
  const normalizedDefaultType = (
    Object.keys(TYPE_LABELS) as ContentType[]
  ).includes(defaultType as ContentType)
    ? (defaultType as ContentType)
    : "LESSON";
  const [type, setType] = useState<ContentType>(
    content?.type ?? normalizedDefaultType,
  );
  const [classId, setClassId] = useState(
    content?.classId ?? defaultClassId ?? classes[0]?.id ?? "",
  );
  const [questions, setQuestions] = useState<EditorQuestion[]>(() =>
    initialQuestions(content, content?.type ?? normalizedDefaultType),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();
  const availableSessions = sessions.filter(
    (session) => session.classId === classId,
  );
  const editable =
    mode === "create" ||
    (content &&
      (actorRole === "ADMIN" || actorRole === "MANAGER"
        ? ["DRAFT", "CHANGES_REQUESTED", "APPROVED", "REOPENED"].includes(
          content.publicationStatus,
        )
        : actorId === content.creatorId &&
        ["DRAFT", "CHANGES_REQUESTED", "REOPENED"].includes(
          content.publicationStatus,
        )));
  const workflowActions = content
    ? availableWorkflowActions(actorId, actorRole, content)
    : [];
  const maxScore = useMemo(
    () =>
      questions.reduce((sum, question) => sum + Number(question.score || 0), 0),
    [questions],
  );

  function updateQuestion(index: number, patch: Partial<EditorQuestion>) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    );
  }

  function changeQuestionType(index: number, nextType: QuestionType) {
    const objective = [
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
    ].includes(nextType);
    const choices = objective
      ? nextType === "TRUE_FALSE"
        ? [
          { key: localKey(), content: "Đúng", isCorrect: true },
          { key: localKey(), content: "Sai", isCorrect: false },
        ]
        : [
          { key: localKey(), content: "", isCorrect: true },
          { key: localKey(), content: "", isCorrect: false },
        ]
      : [];
    updateQuestion(index, { type: nextType, choices });
  }

  function updateChoice(
    questionIndex: number,
    choiceIndex: number,
    patch: Partial<EditorChoice>,
  ) {
    setQuestions((current) =>
      current.map((question, index) => {
        if (index !== questionIndex) return question;
        const multiple = question.type === "MULTIPLE_CHOICE";
        return {
          ...question,
          choices: question.choices.map((choice, currentChoiceIndex) => ({
            ...choice,
            ...(currentChoiceIndex === choiceIndex ? patch : {}),
            ...(patch.isCorrect === true &&
            !multiple &&
            currentChoiceIndex !== choiceIndex
              ? { isCorrect: false }
              : {}),
          })),
        };
      }),
    );
  }

  async function uploadAsset(file: File, contentType: ContentType) {
    if (contentType === "VIDEO") {
      return apiRequest<{ id: string }>("/api/v1/assets", {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": cleanHeaderFileName(file.name),
        },
        body: file,
      });
    }
    const upload = new FormData();
    upload.set("category", "DOCUMENT");
    upload.set("file", file);
    return apiRequest<{ id: string }>("/api/v1/assets", {
      method: "POST",
      body: upload,
    });
  }

  function questionPayload() {
    return questions.map((question, index) => ({
      type: question.type,
      content: question.content,
      order: index + 1,
      score: Number(question.score),
      explanation: question.explanation.trim() || undefined,
      required: question.required,
      choices: question.choices.map((choice, choiceIndex) => ({
        content: choice.content,
        isCorrect: choice.isCorrect,
        order: choiceIndex + 1,
      })),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(undefined);
    try {
      let assetId = content?.payload.assetId;
      if (type === "MATERIAL" || type === "VIDEO") {
        const file = formData.get("file");
        if (file instanceof File && file.size > 0) {
          assetId = (await uploadAsset(file, type)).id;
        }
        if (!assetId) throw new Error("Vui lòng chọn file cần tải lên.");
      }

      const common = {
        classId,
        classSessionId:
          content?.classSessionId ??
          String(formData.get("classSessionId") ?? ""),
        type,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? "").trim() || null,
      };

      let payload: Record<string, unknown>;
      if (type === "LESSON") {
        payload = {
          markdownContent: String(formData.get("markdownContent") ?? ""),
          learningObjectives: String(formData.get("learningObjectives") ?? "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        };
      } else if (type === "MATERIAL") {
        const materialDescription = String(
          formData.get("materialDescription") ?? "",
        ).trim();
        payload = {
          assetId,
          title:
            String(formData.get("materialTitle") ?? "").trim() ||
            String(formData.get("title") ?? ""),
          description: materialDescription || (content ? null : undefined),
        };
      } else if (type === "VIDEO") {
        payload = { assetId };
      } else if (type === "ASSIGNMENT") {
        payload = {
          opensAt:
            optionalIsoDate(formData.get("opensAt")) ??
            (content ? null : undefined),
          dueAt:
            optionalIsoDate(formData.get("dueAt")) ??
            (content ? null : undefined),
          allowLateSubmission: formData.get("allowLateSubmission") === "on",
          maxAttempts: Number(formData.get("maxAttempts")),
          maxScore,
          questions: questionPayload(),
        };
      } else {
        payload = {
          opensAt:
            optionalIsoDate(formData.get("opensAt")) ??
            (content ? null : undefined),
          closesAt:
            optionalIsoDate(formData.get("closesAt")) ??
            (content ? null : undefined),
          durationMinutes: Number(formData.get("durationMinutes")),
          maxAttempts: Number(formData.get("maxAttempts")),
          shuffleQuestions: formData.get("shuffleQuestions") === "on",
          shuffleChoices: formData.get("shuffleChoices") === "on",
          showResultAt:
            optionalIsoDate(formData.get("showResultAt")) ??
            (content ? null : undefined),
          showCorrectAnswersAt:
            optionalIsoDate(formData.get("showCorrectAnswersAt")) ??
            (content ? null : undefined),
          maxScore,
          questions: questionPayload(),
        };
      }

      const body = {
        ...common,
        payload,
        ...(content
          ? {
            expectedUpdatedAt: content.updatedAt,
            reason: String(formData.get("reason") ?? ""),
          }
          : {}),
      };
      if (content) {
        await apiRequest(`/api/v1/contents/${content.id}`, {
          method: "PATCH",
          ...jsonRequest(body),
        });
        setNotice({ message: "Đã cập nhật nội dung.", tone: "success" });
        router.refresh();
      } else {
        const created = await apiRequest<{ id: string }>("/api/v1/contents", {
          method: "POST",
          ...jsonRequest(body),
        });
        router.push(`/dashboard/contents/${created.id}`);
        router.refresh();
      }
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể lưu nội dung.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function workflow(action: WorkflowAction) {
    if (!content) return;
    const requiresComment = ["REQUEST_CHANGES", "REJECT"].includes(action);
    const requiresReason = [
      "REQUEST_REOPEN",
      "REOPEN",
      "REJECT_REOPEN",
      "HIDE",
      "ARCHIVE",
    ].includes(action);
    const explanation =
      requiresComment || requiresReason
        ? await requestReason({
          title: requiresComment
            ? "Nhận xét duyệt nội dung"
            : actionLabel(action),
          label: requiresComment ? "Nhận xét" : "Lý do",
          confirmLabel: actionLabel(action),
          danger: ["REJECT", "REJECT_REOPEN", "HIDE", "ARCHIVE"].includes(action),
        })
        : undefined;
    if ((requiresComment || requiresReason) && !explanation) return;
    setBusy(true);
    setNotice(undefined);
    try {
      const updated = await apiRequest<{ id: string }>(
        `/api/v1/contents/${content.id}/workflow`,
        {
          method: "POST",
          ...jsonRequest({
            action,
            ...(requiresComment ? { comment: explanation } : {}),
            ...(requiresReason ? { reason: explanation } : {}),
          }),
        },
      );
      setNotice({
        message: `Đã ${actionLabel(action).toLowerCase()} nội dung.`,
        tone: "success",
      });
      if (action === "REOPEN" && updated.id !== content.id) {
        router.push(`/dashboard/contents/${updated.id}`);
      }
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể đổi trạng thái.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function permanentlyDelete() {
    if (!content || actorRole !== "ADMIN") return;

    const confirmed = await confirmAction({
      title: "Xóa vĩnh viễn nội dung?",
      description:
        "Thao tác này sẽ xóa nội dung, dữ liệu học tập liên quan và các file không còn được sử dụng. Không thể khôi phục sau khi xóa.",
      confirmLabel: "Tiếp tục xóa",
      danger: true,
    });

    if (!confirmed) return;

    const reason = await requestReason({
      title: "Xác nhận xóa vĩnh viễn",
      description:
        "Hãy nhập lý do xóa. Thông tin này sẽ được giữ lại trong nhật ký kiểm toán.",
      label: "Lý do xóa",
      placeholder: "Ví dụ: Tài liệu tải nhầm...",
      confirmLabel: "Xóa vĩnh viễn",
      danger: true,
      minLength: 3,
    });

    if (!reason) return;

    setBusy(true);
    setNotice(undefined);

    try {
      await apiRequest(
        `/api/v1/contents/${content.id}`,
        {
          method: "DELETE",
          ...jsonRequest({
            reason,
          }),
        },
      );

      router.push("/dashboard/contents");
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Không thể xóa nội dung.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  function typeSpecificFields() {
    const payload = content?.payload;
    if (type === "LESSON") {
      return (
        <>
          <Field
            label="Mục tiêu học tập"
            hint="Mỗi mục tiêu trên một dòng."
            required
          >
            <textarea
              name="learningObjectives"
              defaultValue={payload?.learningObjectives?.join("\n") ?? ""}
              className={TEXTAREA_CLASS}
            />
          </Field>
          <Field label="Nội dung Markdown" required>
            <textarea
              name="markdownContent"
              defaultValue={payload?.markdownContent ?? ""}
              required
              className={`${TEXTAREA_CLASS} min-h-80 font-mono`}
            />
          </Field>
        </>
      );
    }

    if (type === "MATERIAL" || type === "VIDEO") {
      return (
        <>
          <Field
            label={type === "VIDEO" ? "File video" : "File tài liệu"}
            required={!content}
            hint={
              content
                ? "Bỏ trống để giữ file hiện tại; chọn file mới để thay thế."
                : undefined
            }
          >
            <input
              type="file"
              name="file"
              required={!content}
              accept={
                type === "VIDEO"
                  ? "video/mp4,video/webm,video/quicktime"
                  : ".pdf,.docx,.pptx,.xlsx,.txt,.jpg,.jpeg,.png,.webp"
              }
              className={INPUT_CLASS}
            />
          </Field>
          {type === "MATERIAL" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên hiển thị tài liệu">
                <input
                  name="materialTitle"
                  defaultValue={payload?.title ?? content?.title ?? ""}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Mô tả tài liệu">
                <input
                  name="materialDescription"
                  defaultValue={payload?.description ?? ""}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          ) : null}
          {/* {content &&
            type === "MATERIAL" ? (
            <div className="space-y-3">
              <p className="rounded-xl bg-[#F2F4F7] p-4 text-sm text-[#475467]">
                Trạng thái bản xem:{" "}
                <strong>
                  {payload?.previewStatus ??
                    "—"}
                </strong>

                {payload?.previewError ? (
                  <>
                    <br />
                    Lỗi:{" "}
                    {payload.previewError}
                  </>
                ) : null}
              </p>

              <div className="flex flex-wrap gap-3">
                {payload?.viewUrl ? (
                  <Link
                    href={payload.viewUrl}
                    target="_blank"
                    className={
                      SECONDARY_BUTTON
                    }
                  >
                    Xem tài liệu
                  </Link>
                ) : null}

                {payload?.downloadUrl ? (
                  <Link
                    href={payload.downloadUrl}
                    className={
                      SECONDARY_BUTTON
                    }
                  >
                    Tải file gốc
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null} */}
          {content && type === "VIDEO" ? (
            <p className="rounded-xl bg-[#F2F4F7] p-4 text-sm text-[#475467]">
              Trạng thái xử lý: {payload?.processingStatus ?? "—"}
            </p>
          ) : null}
        </>
      );
    }

    const quiz = type === "QUIZ";
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mở lúc">
            <input
              type="datetime-local"
              name="opensAt"
              defaultValue={toDateTimeInput(payload?.opensAt)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label={quiz ? "Đóng lúc" : "Hạn nộp"}>
            <input
              type="datetime-local"
              name={quiz ? "closesAt" : "dueAt"}
              defaultValue={toDateTimeInput(
                quiz ? payload?.closesAt : payload?.dueAt,
              )}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Số lần làm tối đa" required>
            <input
              type="number"
              name="maxAttempts"
              min={1}
              max={20}
              defaultValue={payload?.maxAttempts ?? 1}
              required
              className={INPUT_CLASS}
            />
          </Field>
          {quiz ? (
            <Field label="Thời lượng (phút)" required>
              <input
                type="number"
                name="durationMinutes"
                min={1}
                max={1440}
                defaultValue={payload?.durationMinutes ?? 45}
                required
                className={INPUT_CLASS}
              />
            </Field>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-[#344054]">
          {!quiz ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="allowLateSubmission"
                defaultChecked={payload?.allowLateSubmission}
                className="size-4"
              />
              Cho phép nộp trễ
            </label>
          ) : (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="shuffleQuestions"
                  defaultChecked={payload?.shuffleQuestions}
                  className="size-4"
                />
                Trộn câu hỏi
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="shuffleChoices"
                  defaultChecked={payload?.shuffleChoices}
                  className="size-4"
                />
                Trộn đáp án
              </label>
            </>
          )}
        </div>
        {quiz ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hiện kết quả lúc">
              <input
                type="datetime-local"
                name="showResultAt"
                defaultValue={toDateTimeInput(payload?.showResultAt)}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Hiện đáp án đúng lúc">
              <input
                type="datetime-local"
                name="showCorrectAnswersAt"
                defaultValue={toDateTimeInput(payload?.showCorrectAnswersAt)}
                className={INPUT_CLASS}
              />
            </Field>
          </div>
        ) : null}
        <div className="rounded-xl border border-[#D9E0F2] bg-[#F7F9FF] p-4">
          <p className="text-sm font-semibold text-[#243467]">
            Tổng điểm tối đa: {maxScore}
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            Tổng điểm tối đa được tính từ điểm của từng câu hỏi.
          </p>
        </div>
        <div className="space-y-4">
          {questions.map((question, questionIndex) => (
            <article
              key={question.key}
              className="rounded-2xl border border-[#E4E7EC] bg-[#F9FAFB] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[#172033]">
                  Câu {questionIndex + 1}
                </h3>
                {questions.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions((current) =>
                        current.filter((_, index) => index !== questionIndex),
                      )
                    }
                    className="rounded-lg p-2 text-red-700 hover:bg-red-50"
                    aria-label={`Xóa câu ${questionIndex + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Loại câu hỏi" required>
                  <select
                    value={question.type}
                    onChange={(event) =>
                      changeQuestionType(
                        questionIndex,
                        event.target.value as QuestionType,
                      )
                    }
                    className={INPUT_CLASS}
                  >
                    {(Object.keys(QUESTION_LABELS) as QuestionType[])
                      .filter((item) => !(quiz && item === "FILE_UPLOAD"))
                      .map((item) => (
                        <option key={item} value={item}>
                          {QUESTION_LABELS[item]}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Điểm" required>
                  <input
                    type="number"
                    min={0}
                    step="0.25"
                    value={question.score}
                    onChange={(event) =>
                      updateQuestion(questionIndex, {
                        score: Number(event.target.value),
                      })
                    }
                    className={INPUT_CLASS}
                  />
                </Field>
                <label className="flex items-end gap-2 pb-3 text-sm text-[#344054]">
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) =>
                      updateQuestion(questionIndex, {
                        required: event.target.checked,
                      })
                    }
                    className="size-4"
                  />
                  Bắt buộc trả lời
                </label>
              </div>
              <Field label="Nội dung câu hỏi" required className="mt-4">
                <textarea
                  value={question.content}
                  onChange={(event) =>
                    updateQuestion(questionIndex, {
                      content: event.target.value,
                    })
                  }
                  required
                  className={TEXTAREA_CLASS}
                />
              </Field>
              <Field label="Giải thích đáp án" className="mt-4">
                <textarea
                  value={question.explanation}
                  onChange={(event) =>
                    updateQuestion(questionIndex, {
                      explanation: event.target.value,
                    })
                  }
                  className={TEXTAREA_CLASS}
                />
              </Field>
              {question.choices.length ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold text-[#344054]">
                    {question.type === "MULTIPLE_CHOICE"
                      ? "Lựa chọn (có thể đánh dấu nhiều đáp án đúng)"
                      : "Lựa chọn (đánh dấu một đáp án đúng)"}
                  </p>
                  {question.choices.map((choice, choiceIndex) => (
                    <div
                      key={choice.key}
                      className="flex items-center gap-3 rounded-xl bg-white p-3"
                    >
                      <input
                        type={
                          question.type === "MULTIPLE_CHOICE"
                            ? "checkbox"
                            : "radio"
                        }
                        name={`correct-${question.key}`}
                        checked={choice.isCorrect}
                        onChange={(event) =>
                          updateChoice(questionIndex, choiceIndex, {
                            isCorrect:
                              question.type === "MULTIPLE_CHOICE"
                                ? event.target.checked
                                : true,
                          })
                        }
                        className="size-4"
                      />
                      <input
                        value={choice.content}
                        onChange={(event) =>
                          updateChoice(questionIndex, choiceIndex, {
                            content: event.target.value,
                          })
                        }
                        required
                        placeholder={`Lựa chọn ${choiceIndex + 1}`}
                        className={`${INPUT_CLASS} mt-0`}
                      />
                      {question.choices.length > 2 ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateQuestion(questionIndex, {
                              choices: question.choices.filter(
                                (_, index) => index !== choiceIndex,
                              ),
                            })
                          }
                          className="rounded-lg p-2 text-red-700 hover:bg-red-50"
                          aria-label="Xóa lựa chọn"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {question.choices.length < 20 ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateQuestion(questionIndex, {
                          choices: [
                            ...question.choices,
                            {
                              key: localKey(),
                              content: "",
                              isCorrect: false,
                            },
                          ],
                        })
                      }
                      className={SECONDARY_BUTTON}
                    >
                      <Plus className="mr-2 size-4" />
                      Thêm lựa chọn
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
          <button
            type="button"
            onClick={() =>
              setQuestions((current) => [...current, emptyQuestion(quiz)])
            }
            className={SECONDARY_BUTTON}
          >
            <Plus className="mr-2 size-4" />
            Thêm câu hỏi
          </button>
        </div>
      </>
    );
  }

  const form = (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại nội dung" required>
          <select
            name="type"
            value={type}
            disabled={Boolean(content)}
            onChange={(event) => {
              const next = event.target.value as ContentType;
              setType(next);
              setQuestions(initialQuestions(null, next));
            }}
            className={INPUT_CLASS}
          >
            {(Object.keys(TYPE_LABELS) as ContentType[]).map((item) => (
              <option key={item} value={item}>
                {TYPE_LABELS[item]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lớp học" required>
          <select
            name="classId"
            value={classId}
            disabled={Boolean(content)}
            onChange={(event) => setClassId(event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Chọn lớp</option>
            {classes.map((courseClass) => (
              <option key={courseClass.id} value={courseClass.id}>
                {courseClass.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Buổi học" required>
          <select
            name="classSessionId"
            defaultValue={content?.classSessionId ?? ""}
            disabled={Boolean(content)}
            required
            className={INPUT_CLASS}
          >
            <option value="">Chọn buổi học</option>
            {availableSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tiêu đề" required>
          <input
            name="title"
            defaultValue={content?.title ?? ""}
            minLength={2}
            maxLength={200}
            required
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <Field label="Mô tả">
        <textarea
          name="description"
          defaultValue={content?.description ?? ""}
          className={TEXTAREA_CLASS}
        />
      </Field>
      {typeSpecificFields()}
      {content ? (
        <Field label="Lý do chỉnh sửa" required>
          <textarea
            name="reason"
            minLength={3}
            required
            className={TEXTAREA_CLASS}
          />
        </Field>
      ) : null}
      <div className="flex justify-end">
        <button disabled={busy} className={PRIMARY_BUTTON}>
          <BusyLabel
            busy={busy}
            idle={content ? "Lưu nội dung" : "Tạo nội dung"}
            working={
              type === "VIDEO" || type === "MATERIAL"
                ? "Đang tải và lưu…"
                : "Đang lưu…"
            }
          />
        </button>
      </div>
    </form>
  );

  if (mode === "create") {
    return (
      <SectionCard
        title="Tạo nội dung"
        description="Nội dung được tạo ở trạng thái nháp và phải đi qua quy trình duyệt/xuất bản phù hợp."
        id="edit"
      >
        <MutationNotice {...notice} />
        <div className="mt-5">{form}</div>
      </SectionCard>
    );
  }

  if (!content) return null;

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard title="Thông tin nội dung">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-[#667085]">Loại</dt>
            <dd className="mt-1 font-semibold">{TYPE_LABELS[content.type]}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Lớp</dt>
            <dd className="mt-1 font-semibold">{content.courseClass.code}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Buổi</dt>
            <dd className="mt-1 font-semibold">
              {content.classSession.sessionNumber}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Phiên bản</dt>
            <dd className="mt-1 font-semibold">v{content.version}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Trạng thái</dt>
            <dd className="mt-1 font-semibold">{content.publicationStatus}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-[#667085]">
          Người tạo: {content.creator.name} ({content.creator.role})
        </p>
        {content.type === "VIDEO" && content.payload.recordingId ? (
          <Link
            href={`/dashboard/videos/${content.payload.recordingId}`}
            className={`${SECONDARY_BUTTON} mt-4`}
          >
            Xem trình phát video
          </Link>
        ) : null}
        {content.type === "MATERIAL" ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[#667085]">
                  Trạng thái bản xem:
                </span>

                <span className="text-sm font-semibold text-[#344054]">
                  {content.payload.previewStatus === "READY"
                    ? "Sẵn sàng"
                    : content.payload.previewStatus === "PROCESSING"
                      ? "Đang xử lý"
                      : content.payload.previewStatus === "FAILED"
                        ? "Xử lý thất bại"
                        : content.payload.previewStatus === "PENDING"
                          ? "Đang chờ xử lý"
                          : "Chưa có"}
                </span>
              </div>

              {content.payload.previewError ? (
                <p className="mt-2 text-sm text-red-600">
                  {content.payload.previewError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              {content.payload.viewUrl ? (
                <Link
                  href={content.payload.viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={PRIMARY_BUTTON}
                >
                  Xem tài liệu
                </Link>
              ) : null}

              {content.payload.downloadUrl ? (
                <Link
                  href={content.payload.downloadUrl}
                  className={SECONDARY_BUTTON}
                >
                  Tải file gốc
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </SectionCard>

      {editable ? (
        <SectionCard title="Chỉnh sửa nội dung" id="edit">
          {form}
        </SectionCard>
      ) : (
        <SectionCard
          title="Nội dung đang khóa chỉnh sửa"
          description="Nội dung đã xuất bản hoặc lưu trữ không được sửa trực tiếp. Hãy dùng quy trình mở lại để tạo phiên bản mới."
        >
          <p className="text-sm text-[#667085]">
            Không có biểu mẫu chỉnh sửa ở trạng thái {content.publicationStatus}
            .
          </p>
        </SectionCard>
      )}

      <SectionCard
        title="Quy trình duyệt và xuất bản"
        description="Chỉ các chuyển trạng thái hợp lệ mới được hiển thị; server vẫn kiểm quyền lại."
      >
        {workflowActions.length ? (
          <div className="flex flex-wrap gap-3">
            {workflowActions.map((action) => {
              const danger = [
                "REJECT",
                "HIDE",
                "ARCHIVE",
                "REJECT_REOPEN",
              ].includes(action);
              const Icon =
                action === "PUBLISH"
                  ? Send
                  : action === "APPROVE"
                    ? Check
                    : action === "REQUEST_REOPEN" || action === "REOPEN"
                      ? RotateCcw
                      : action === "HIDE"
                        ? EyeOff
                        : action === "ARCHIVE"
                          ? Archive
                          : action === "REJECT" || action === "REJECT_REOPEN"
                            ? X
                            : FileUp;
              return (
                <button
                  key={action}
                  type="button"
                  disabled={busy}
                  onClick={() => workflow(action)}
                  className={danger ? DANGER_BUTTON : PRIMARY_BUTTON}
                >
                  <Icon className="mr-2 size-4" />
                  {actionLabel(action)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[#667085]">
            Không có thao tác chuyển trạng thái phù hợp ở thời điểm hiện tại.
          </p>
        )}
      </SectionCard>

      {actorRole === "ADMIN" ? (
        <SectionCard
          title="Vùng nguy hiểm"
          description="Xóa vĩnh viễn sẽ loại bỏ nội dung và dữ liệu liên quan. Thao tác này không thể hoàn tác."
        >
          <button
            type="button"
            disabled={busy}
            onClick={permanentlyDelete}
            className={DANGER_BUTTON}
          >
            <Trash2 className="mr-2 size-4" />
            <BusyLabel
              busy={busy}
              idle="Xóa vĩnh viễn"
              working="Đang xóa…"
            />
          </button>
        </SectionCard>
      ) : null}

      <SectionCard title="Lịch sử duyệt">
        {content.reviews?.length ? (
          <div className="space-y-3">
            {content.reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-[#E4E7EC] p-4"
              >
                <p className="text-sm font-semibold">
                  {review.action} · {review.reviewer.name}
                </p>
                <p className="mt-1 text-xs text-[#667085]">
                  {new Date(review.createdAt).toLocaleString("vi-VN")}
                </p>
                {review.comment ? (
                  <p className="mt-2 text-sm text-[#475467]">
                    {review.comment}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#667085]">Chưa có lịch sử duyệt.</p>
        )}
      </SectionCard>
    </div>
  );
}
