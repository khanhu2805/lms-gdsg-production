export type QuizAvailability = "NOT_OPEN" | "OPEN" | "CLOSED" | "EXPIRED";

export function calculateAttemptExpiry(input: {
  serverNow: Date;
  durationMinutes: number;
  quizClosesAt?: Date | null;
}) {
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
    throw new Error("Thời lượng bài kiểm tra phải là số nguyên dương.");
  }

  const durationExpiry = new Date(
    input.serverNow.getTime() + input.durationMinutes * 60_000,
  );
  if (!input.quizClosesAt) return durationExpiry;
  return durationExpiry < input.quizClosesAt
    ? durationExpiry
    : input.quizClosesAt;
}

export function getQuizAvailability(input: {
  serverNow: Date;
  opensAt?: Date | null;
  closesAt?: Date | null;
  attemptExpiresAt?: Date | null;
}): QuizAvailability {
  if (input.opensAt && input.serverNow < input.opensAt) return "NOT_OPEN";
  if (input.closesAt && input.serverNow >= input.closesAt) return "CLOSED";
  if (input.attemptExpiresAt && input.serverNow >= input.attemptExpiresAt) {
    return "EXPIRED";
  }
  return "OPEN";
}
