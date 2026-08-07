export type CapacityState =
  "AVAILABLE" | "NEARLY_FULL" | "FULL" | "OVER_CAPACITY";

export type CapacitySummary = {
  capacity: number;
  activeStudents: number;
  remaining: number;
  utilizationPercent: number;
  state: CapacityState;
};

export function calculateCapacity(
  capacity: number,
  activeStudents: number,
): CapacitySummary {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Sức chứa phải là số nguyên dương.");
  }
  if (!Number.isInteger(activeStudents) || activeStudents < 0) {
    throw new Error("Số học sinh phải là số nguyên không âm.");
  }

  const utilizationPercent = (activeStudents / capacity) * 100;
  let state: CapacityState = "AVAILABLE";

  if (activeStudents > capacity) state = "OVER_CAPACITY";
  else if (activeStudents === capacity) state = "FULL";
  else if (utilizationPercent >= 80) state = "NEARLY_FULL";

  return {
    capacity,
    activeStudents,
    remaining: capacity - activeStudents,
    utilizationPercent,
    state,
  };
}

export function canAddStudent(input: {
  capacity: number;
  activeStudents: number;
  actorRole: string;
  hasOverridePermission?: boolean;
  overrideReason?: string;
}) {
  const summary = calculateCapacity(input.capacity, input.activeStudents);
  if (summary.remaining > 0) return true;

  if (input.actorRole === "ADMIN" && Boolean(input.overrideReason?.trim())) {
    return true;
  }

  return (
    input.actorRole === "MANAGER" &&
    Boolean(input.hasOverridePermission) &&
    Boolean(input.overrideReason?.trim())
  );
}
