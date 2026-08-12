"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Answer = {
  questionId: string;
  answerText?: string | null;
  selectedChoiceIds?: string[];
};

type Question = {
  id: string;
  type: string;
  content: string;
  order: number;
  score: number;
  required: boolean;
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

export function StudentQuizPlayer({ quizId }: { quizId: string }) {
  const [attempt, setAttempt] = useState<Attempt>();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [remaining, setRemaining] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
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
      try {
        await api(`/api/v1/quiz-attempts/${attempt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: answerList }),
        });
      } catch (error) {
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
    [attempt, loadAttempt, save],
  );

  useEffect(() => {
    if (!hydrated.current || !attempt || attempt.status !== "IN_PROGRESS") {
      return;
    }

    const timer = window.setTimeout(() => {
      void save(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [attempt, save]);

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

  return (
    <section className="space-y-5">
      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D0D5DD] bg-white/95 p-4 shadow-sm backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
            Lượt {attempt.attemptNumber}
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
        </div>
        {editable ? (
          <button
            disabled={busy}
            onClick={() => void submit(false)}
            className="min-h-10 rounded-xl bg-[#243467] px-4 text-sm font-semibold text-white"
          >
            Nộp bài
          </button>
        ) : null}
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

      {attempt.questions.map((question, index) => {
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

            {["SINGLE_CHOICE", "TRUE_FALSE"].includes(question.type) ? (
              <div className="mt-4 space-y-2">
                {question.choices.map((choice) => (
                  <label
                    key={choice.id}
                    className="flex items-start gap-3 rounded-xl border border-[#E4E7EC] p-3"
                  >
                    <input
                      disabled={!editable}
                      type="radio"
                      name={question.id}
                      checked={answer.selectedChoiceIds?.[0] === choice.id}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: {
                            questionId: question.id,
                            selectedChoiceIds: [choice.id],
                          },
                        }))
                      }
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
