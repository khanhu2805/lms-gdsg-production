"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Answer = {
  questionId: string;
  answerText?: string | null;
  selectedChoiceIds?: string[];
  autoScore?: string | number | null;
  manualScore?: string | number | null;
  feedback?: string | null;
};

type Question = {
  id: string;
  type: string;
  content: string;
  order: number;
  score: number;
  required: boolean;
  explanation?: string | null;
  choices: Array<{
    id: string;
    content: string;
    order: number;
  }>;
};

type Submission = {
  id: string;
  attemptNumber: number;
  status: string;
  submittedAt?: string | null;
  isLate: boolean;
  finalScore?: number | null;
  teacherFeedback?: string | null;
  publishedAt?: string | null;
  answers?: Answer[];
  files: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: string;
  }>;
};

type Assignment = {
  id: string;
  opensAt?: string | null;
  dueAt?: string | null;
  allowLateSubmission: boolean;
  maxAttempts: number;
  maxScore: number;
  content: {
    title: string;
    description?: string | null;
    classSessionId: string;
  };
  questions: Question[];
  submissions: Submission[];
};

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

function isObjectiveQuestion(type: string) {
  return ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(type);
}

function scoreForAnswer(answer?: Answer) {
  if (!answer) return 0;
  return Number(answer.manualScore ?? answer.autoScore ?? 0);
}

async function api<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
  });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body.success) {
    throw new Error(body.success ? "Yêu cầu thất bại." : body.error.message);
  }
  return body.data;
}

function submissionState(data: Assignment) {
  const latest = data.submissions[0];
  const nextAnswers: Record<string, Answer> = {};
  for (const answer of latest?.answers ?? []) {
    nextAnswers[answer.questionId] = answer;
  }
  return {
    answers: nextAnswers,
    fileIds: (latest?.files ?? []).map((file) => file.id),
    files: (latest?.files ?? []).map((file) => ({
      id: file.id,
      originalName: file.originalName,
    })),
  };
}

export function StudentAssignmentPlayer({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const [assignment, setAssignment] = useState<Assignment>();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [files, setFiles] = useState<
    Array<{ id: string; originalName: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [savedAt, setSavedAt] = useState<Date>();
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hydrated.current = false;

    void api<Assignment>(`/api/v1/assignments/${assignmentId}`)
      .then((data) => {
        if (cancelled) return;
        const state = submissionState(data);
        setAssignment(data);
        setAnswers(state.answers);
        setFileIds(state.fileIds);
        setFiles(state.files);
        setMessage(undefined);
        hydrated.current = true;
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(
          error instanceof Error ? error.message : "Không tải được bài tập.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const latest = assignment?.submissions[0];
  const editable = !latest || latest.status === "DRAFT";
  const answerList = useMemo(
    () =>
      assignment?.questions.map(
        (question) => answers[question.id] ?? { questionId: question.id },
      ) ?? [],
    [assignment, answers],
  );

  async function refresh() {
    const data = await api<Assignment>(`/api/v1/assignments/${assignmentId}`);
    const state = submissionState(data);
    setAssignment(data);
    setAnswers(state.answers);
    setFileIds(state.fileIds);
    setFiles(state.files);
    hydrated.current = true;
  }

  async function save(action: "SAVE" | "SUBMIT", silent = false) {
    if (!assignment || !editable) return;
    if (!silent) {
      setBusy(true);
      setMessage(undefined);
    }

    try {
      await api(`/api/v1/assignments/${assignmentId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          answers: answerList,
          fileAssetIds: fileIds,
        }),
      });
      setSavedAt(new Date());

      if (action === "SUBMIT") {
        setMessage("Đã nộp bài thành công.");
        await refresh();
      }
    } catch (error) {
      if (!silent) {
        setMessage(
          error instanceof Error ? error.message : "Không thể lưu bài.",
        );
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }

  useEffect(() => {
    if (!hydrated.current || !assignment || !editable) return;

    const timer = window.setTimeout(() => {
      void api(`/api/v1/assignments/${assignmentId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE",
          answers: answerList,
          fileAssetIds: fileIds,
        }),
      })
        .then(() => setSavedAt(new Date()))
        .catch(() => {
          // Autosave is best-effort. Explicit save/submit surfaces errors.
        });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [answerList, assignment, assignmentId, editable, fileIds]);

  async function upload(selected: FileList | null) {
    if (!selected?.length) return;
    setBusy(true);
    setMessage(undefined);

    try {
      for (const file of Array.from(selected)) {
        const form = new FormData();
        form.set("category", "SUBMISSION");
        form.set("file", file);
        const asset = await api<{ id: string; originalName: string }>(
          "/api/v1/assets",
          { method: "POST", body: form },
        );
        setFileIds((current) =>
          current.includes(asset.id) ? current : [...current, asset.id],
        );
        setFiles((current) => [
          ...current,
          { id: asset.id, originalName: asset.originalName },
        ]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tải được file.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!assignment) {
    return (
      <div className="rounded-2xl border border-[#E4E7EC] bg-white p-6 text-sm text-[#667085]">
        {message ?? "Đang tải bài tập…"}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#667085]">
          <span>
            Điểm tối đa:{" "}
            <strong className="text-[#172033]">{assignment.maxScore}</strong>
          </span>
          <span>
            Số lần làm:{" "}
            <strong className="text-[#172033]">{assignment.maxAttempts}</strong>
          </span>
          {assignment.dueAt ? (
            <span>
              Hạn nộp:{" "}
              <strong className="text-[#172033]">
                {new Date(assignment.dueAt).toLocaleString("vi-VN")}
              </strong>
            </span>
          ) : null}
        </div>
        {latest && latest.status !== "DRAFT" ? (
          <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            Bài đã nộp · Lần {latest.attemptNumber}
            {latest.publishedAt ? (
              <>
                {" "}
                · Điểm: {latest.finalScore ?? "—"}/{assignment.maxScore}
                {latest.teacherFeedback ? (
                  <p className="mt-2">Nhận xét: {latest.teacherFeedback}</p>
                ) : null}
              </>
            ) : (
              " · Kết quả chưa được công bố"
            )}
          </div>
        ) : null}
      </div>

      {assignment.questions.map((question, index) => {
        const answer = answers[question.id] ?? { questionId: question.id };
        return (
          <article
            key={question.id}
            className="rounded-2xl border border-[#E4E7EC] bg-white p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-semibold text-[#172033]">
                Câu {index + 1}. {question.content}
                {question.required ? (
                  <span className="text-red-600"> *</span>
                ) : null}
              </h2>
              <span className="text-xs font-semibold text-[#667085]">
                {question.score} điểm
              </span>
            </div>

            {isObjectiveQuestion(question.type) ? (
              <div className="mt-4 space-y-2">
                {question.choices.map((choice) => (
                  <label
                    key={choice.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E4E7EC] p-3 hover:bg-[#F7F8FC]"
                  >
                    <input
                      disabled={!editable}
                      type={
                        question.type === "MULTIPLE_CHOICE"
                          ? "checkbox"
                          : "radio"
                      }
                      name={question.id}
                      checked={
                        answer.selectedChoiceIds?.includes(choice.id) ?? false
                      }
                      onChange={(event) => {
                        const current = answer.selectedChoiceIds ?? [];
                        const selectedChoiceIds =
                          question.type === "MULTIPLE_CHOICE"
                            ? event.target.checked
                              ? [...new Set([...current, choice.id])]
                              : current.filter((id) => id !== choice.id)
                            : [choice.id];

                        setAnswers((currentAnswers) => ({
                          ...currentAnswers,
                          [question.id]: {
                            questionId: question.id,
                            selectedChoiceIds,
                          },
                        }));
                      }}
                    />
                    <span className="text-sm text-[#344054]">
                      {choice.content}
                    </span>
                  </label>
                ))}
              </div>
            ) : question.type === "FILE_UPLOAD" ? (
              <div className="mt-4">
                <input
                  disabled={!editable || busy}
                  type="file"
                  multiple
                  onChange={(event) => void upload(event.target.files)}
                  className="block w-full text-sm"
                />
                {files.length ? (
                  <ul className="mt-3 space-y-1 text-xs text-[#667085]">
                    {files.map((file) => (
                      <li key={file.id}>• {file.originalName}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <textarea
                disabled={!editable}
                value={answer.answerText ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: {
                      questionId: question.id,
                      answerText: event.target.value,
                    },
                  }))
                }
                rows={question.type === "ESSAY" ? 8 : 3}
                className="mt-4 w-full rounded-xl border border-[#D0D5DD] px-3.5 py-3 text-sm outline-none focus:border-[#4059A5] focus:ring-2 focus:ring-[#4059A5]/20"
              />
            )}

            {latest?.publishedAt ? (
              <div className="mt-4 rounded-xl bg-[#F7F9FF] p-4 text-sm">
                <p className="font-semibold text-[#243467]">
                  Điểm câu: {scoreForAnswer(answer)} / {question.score}
                </p>
                {answer.feedback ? (
                  <p className="mt-2 text-[#475467]">
                    Nhận xét: {answer.feedback}
                  </p>
                ) : null}
                {question.explanation ? (
                  <p className="mt-2 text-[#667085]">
                    Giải thích: {question.explanation}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}

      {editable ? (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D0D5DD] bg-white/95 p-4 shadow-lg backdrop-blur">
          <p className="text-xs text-[#667085]">
            {savedAt
              ? `Đã tự lưu lúc ${savedAt.toLocaleTimeString("vi-VN")}`
              : "Bài làm được tự lưu sau khi bạn thay đổi câu trả lời."}
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void save("SAVE")}
              className="min-h-10 rounded-xl border border-[#D0D5DD] px-4 text-sm font-semibold"
            >
              Lưu nháp
            </button>
            <button
              disabled={busy}
              onClick={() => void save("SUBMIT")}
              className="min-h-10 rounded-xl bg-[#243467] px-4 text-sm font-semibold text-white"
            >
              {busy ? "Đang xử lý…" : "Nộp bài"}
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-[#F7F8FC] p-3 text-sm text-[#344054]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
