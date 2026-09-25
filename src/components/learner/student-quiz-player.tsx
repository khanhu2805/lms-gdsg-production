"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    isCorrect?: boolean;
  }>;
};

type Attempt = {
  id: string;
  attemptNumber: number;
  status: string;
  serverNow: string;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string | null;
  result?: { finalScore?: number | null; maxScore: number } | null;
  questions: Question[];
  answers: Answer[];
};

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string } };

type SaveStatus = "idle" | "saving" | "saved" | "error";

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

function isObjectiveQuestion(type: string) {
  return ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(type);
}

function isAnswered(question: Question, answer?: Answer) {
  if (isObjectiveQuestion(question.type)) {
    return Boolean(answer?.selectedChoiceIds?.length);
  }
  return Boolean(answer?.answerText?.trim());
}

function scoreForAnswer(answer?: Answer) {
  if (!answer) return 0;
  const value = answer.manualScore ?? answer.autoScore ?? 0;
  return Number(value);
}

export function StudentQuizPlayer({ quizId }: { quizId: string }) {
  const [attempt, setAttempt] = useState<Attempt>();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [remaining, setRemaining] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [savedAt, setSavedAt] = useState<Date>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [reviewQuestionIds, setReviewQuestionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const hydrated = useRef(false);
  const submitting = useRef(false);

  const loadAttempt = useCallback(async (id: string) => {
    const data = await api<Attempt>(`/api/v1/quiz-attempts/${id}`);
    const next: Record<string, Answer> = {};
    for (const answer of data.answers) {
      next[answer.questionId] = answer;
    }

    setAttempt(data);
    setAnswers(next);
    setRemaining(
      Math.max(
        0,
        Math.ceil(
          (new Date(data.expiresAt).getTime() -
            new Date(data.serverNow).getTime()) /
            1000,
        ),
      ),
    );
    setSaveStatus("idle");
    setSavedAt(undefined);
    hydrated.current = true;
  }, []);

  async function start() {
    setBusy(true);
    setMessage(undefined);
    try {
      const started = await api<{ id: string }>(
        `/api/v1/quizzes/${quizId}/attempts`,
        { method: "POST" },
      );
      await loadAttempt(started.id);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể bắt đầu bài kiểm tra.",
      );
    } finally {
      setBusy(false);
    }
  }

  const answerList = useMemo(
    () =>
      attempt?.questions.map(
        (question) => answers[question.id] ?? { questionId: question.id },
      ) ?? [],
    [attempt, answers],
  );

  const save = useCallback(
    async (silent = true) => {
      if (!attempt || attempt.status !== "IN_PROGRESS") return;

      setSaveStatus("saving");
      try {
        const result = await api<{ savedAt: string }>(
          `/api/v1/quiz-attempts/${attempt.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers: answerList }),
          },
        );
        setSavedAt(new Date(result.savedAt));
        setSaveStatus("saved");
      } catch (error) {
        setSaveStatus("error");
        if (!silent) {
          setMessage(
            error instanceof Error ? error.message : "Không thể lưu đáp án.",
          );
        }
      }
    },
    [answerList, attempt],
  );

  const submit = useCallback(
    async (auto = false) => {
      if (!attempt || submitting.current) return;

      if (!auto) {
        const unansweredRequired = attempt.questions.filter(
          (question) => question.required && !isAnswered(question, answers[question.id]),
        ).length;
        const unansweredTotal = attempt.questions.filter(
          (question) => !isAnswered(question, answers[question.id]),
        ).length;

        const detail = unansweredRequired
          ? `Bạn còn ${unansweredRequired} câu bắt buộc chưa trả lời.\n`
          : unansweredTotal
            ? `Bạn còn ${unansweredTotal} câu chưa trả lời.\n`
            : "";

        if (
          !window.confirm(
            `${detail}Bạn có chắc chắn muốn nộp bài? Sau khi nộp sẽ không thể sửa câu trả lời.`,
          )
        ) {
          return;
        }
      }

      submitting.current = true;
      setBusy(true);
      if (!auto) setMessage(undefined);

      try {
        await save(true);
        await api(`/api/v1/quiz-attempts/${attempt.id}`, { method: "POST" });
        setMessage(
          auto
            ? "Hết giờ. Hệ thống đã tự động nộp bài."
            : "Đã nộp bài kiểm tra.",
        );
        await loadAttempt(attempt.id);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Không thể nộp bài.",
        );
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    },
    [answers, attempt, loadAttempt, save],
  );

  useEffect(() => {
    if (!hydrated.current || !attempt || attempt.status !== "IN_PROGRESS") {
      return;
    }

    const timer = window.setTimeout(() => {
      void save(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [answers, attempt, save]);

  const attemptId = attempt?.id;
  const attemptStatus = attempt?.status;

  useEffect(() => {
    if (!attemptId || attemptStatus !== "IN_PROGRESS") return;

    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, (value ?? 0) - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [attemptId, attemptStatus]);

  useEffect(() => {
    if (
      !attempt ||
      attempt.status !== "IN_PROGRESS" ||
      remaining === undefined ||
      remaining > 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void submit(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [attempt, remaining, submit]);

  if (!attempt) {
    return (
      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#172033]">Bài kiểm tra</h2>
        <p className="mt-2 text-sm text-[#667085]">
          Thời gian làm bài được tính hoàn toàn từ máy chủ. Nhấn bắt đầu khi
          bạn đã sẵn sàng.
        </p>
        <button
          disabled={busy}
          onClick={() => void start()}
          className="mt-5 min-h-11 rounded-xl bg-[#243467] px-4 text-sm font-semibold text-white"
        >
          {busy ? "Đang bắt đầu…" : "Bắt đầu làm bài"}
        </button>
        {message ? <p className="mt-3 text-sm text-red-700">{message}</p> : null}
      </section>
    );
  }

  const editable = attempt.status === "IN_PROGRESS";
  const mm = Math.floor((remaining ?? 0) / 60);
  const ss = (remaining ?? 0) % 60;
  const answeredCount = attempt.questions.filter((question) =>
    isAnswered(question, answers[question.id]),
  ).length;

  return (
    <section className="space-y-5">
      <div className="sticky top-16 z-10 rounded-2xl border border-[#D0D5DD] bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
              Lượt {attempt.attemptNumber} · Đã làm {answeredCount}/{attempt.questions.length}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#172033]">
              {editable ? (
                <>
                  Thời gian còn lại:{" "}
                  <span
                    className={
                      remaining !== undefined && remaining < 300
                        ? "text-red-600"
                        : "text-[#243467]"
                    }
                  >
                    {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                  </span>
                </>
              ) : (
                "Bài đã nộp"
              )}
            </p>
            {editable ? (
              <p
                className={
                  saveStatus === "error"
                    ? "mt-1 text-xs text-red-600"
                    : "mt-1 text-xs text-[#667085]"
                }
              >
                {saveStatus === "saving"
                  ? "Đang lưu bài làm…"
                  : saveStatus === "error"
                    ? "Tự lưu thất bại. Kiểm tra kết nối mạng."
                    : savedAt
                      ? `Đã lưu lúc ${savedAt.toLocaleTimeString("vi-VN")}`
                      : "Bài làm sẽ được tự động lưu."}
              </p>
            ) : null}
          </div>
          {editable ? (
            <button
              disabled={busy || saveStatus === "saving"}
              onClick={() => void submit(false)}
              className="min-h-10 rounded-xl bg-[#243467] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Đang nộp…" : "Nộp bài"}
            </button>
          ) : null}
        </div>
      </div>

      {attempt.result ? (
        <div className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
          Kết quả đã công bố:{" "}
          <strong>
            {attempt.result.finalScore ?? "—"}/{attempt.result.maxScore}
          </strong>
        </div>
      ) : !editable ? (
        <div className="rounded-2xl bg-[#F7F8FC] p-5 text-sm text-[#667085]">
          Bài đã nộp. Kết quả sẽ hiển thị sau khi được công bố theo cấu hình
          của bài kiểm tra.
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {attempt.questions.map((question, index) => {
            const answered = isAnswered(question, answers[question.id]);
            const review = reviewQuestionIds.has(question.id);
            return (
              <button
                key={question.id}
                type="button"
                onClick={() =>
                  document
                    .getElementById(`question-${question.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className={`flex size-10 items-center justify-center rounded-lg border text-sm font-semibold ${
                  review
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : answered
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-[#D0D5DD] bg-white text-[#667085]"
                }`}
                aria-label={`Đi đến câu ${index + 1}`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-[#667085]">
          Xanh: đã trả lời · Trắng: chưa trả lời · Vàng: đánh dấu xem lại
        </p>
      </div>

      {attempt.questions.map((question, index) => {
        const answer = answers[question.id] ?? { questionId: question.id };
        const review = reviewQuestionIds.has(question.id);
        return (
          <article
            id={`question-${question.id}`}
            key={question.id}
            className="scroll-mt-36 rounded-2xl border border-[#E4E7EC] bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[#172033]">
                  Câu {index + 1}. {question.content}
                  {question.required ? (
                    <span className="text-red-600"> *</span>
                  ) : null}
                </h2>
                {question.type === "MULTIPLE_CHOICE" ? (
                  <p className="mt-1 text-xs text-[#667085]">
                    Có thể chọn nhiều đáp án.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {editable ? (
                  <button
                    type="button"
                    onClick={() =>
                      setReviewQuestionIds((current) => {
                        const next = new Set(current);
                        if (next.has(question.id)) next.delete(question.id);
                        else next.add(question.id);
                        return next;
                      })
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                      review
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-[#D0D5DD] text-[#667085]"
                    }`}
                  >
                    {review ? "Đã đánh dấu" : "Xem lại"}
                  </button>
                ) : null}
                <span className="text-xs font-semibold text-[#667085]">
                  {question.score} điểm
                </span>
              </div>
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
                    {choice.isCorrect === true ? (
                      <span className="ml-auto text-xs font-semibold text-emerald-700">
                        Đáp án đúng
                      </span>
                    ) : null}
                  </label>
                ))}
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
                rows={question.type === "ESSAY" ? 7 : 3}
                className="mt-4 w-full rounded-xl border border-[#D0D5DD] px-3.5 py-3 text-sm outline-none focus:border-[#4059A5] focus:ring-2 focus:ring-[#4059A5]/20"
              />
            )}

            {attempt.result ? (
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

      {message ? (
        <p className="rounded-xl bg-[#F7F8FC] p-3 text-sm text-[#344054]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
