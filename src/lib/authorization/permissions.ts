import type { UserRole } from "@/generated/prisma/enums";

export type ClassRelationship = {
  isTeacher?: boolean;
  isAssistant?: boolean;
  isStudent?: boolean;
  isLinkedParent?: boolean;
};

export function canManageUsers(actorRole: UserRole) {
  return actorRole === "ADMIN" || actorRole === "MANAGER";
}

export function canActOnUser(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
  action: "UPDATE" | "LOCK" | "DELETE" | "RESTORE" | "REVOKE_SESSIONS",
  requestedRole?: UserRole,
) {
  if (actor.role === "ADMIN") {
    if (actor.id === target.id && (action === "LOCK" || action === "DELETE")) {
      return false;
    }
    return true;
  }

  if (actor.role !== "MANAGER") return false;
  if (target.role === "ADMIN" || requestedRole === "ADMIN") return false;
  return true;
}

export function canCreateRole(actorRole: UserRole, role: UserRole) {
  if (actorRole === "ADMIN") return true;
  return (
    actorRole === "MANAGER" &&
    ["TEACHER", "TEACHING_ASSISTANT", "STUDENT", "PARENT"].includes(role)
  );
}

export function canManageClass(actorRole: UserRole) {
  return actorRole === "ADMIN" || actorRole === "MANAGER";
}

export function canManageClassSession(actorRole: UserRole) {
  return actorRole === "ADMIN" || actorRole === "MANAGER";
}

export function canAccessClass(
  actorRole: UserRole,
  relationship: ClassRelationship,
) {
  if (actorRole === "ADMIN" || actorRole === "MANAGER") return true;
  if (actorRole === "TEACHER") return Boolean(relationship.isTeacher);
  if (actorRole === "TEACHING_ASSISTANT") {
    return Boolean(relationship.isAssistant);
  }
  if (actorRole === "STUDENT") return Boolean(relationship.isStudent);
  if (actorRole === "PARENT") return Boolean(relationship.isLinkedParent);
  return false;
}

export function canViewClassMembers(actorRole: UserRole) {
  return ["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"].includes(
    actorRole,
  );
}

export function canMarkAttendance(actorRole: UserRole) {
  return ["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"].includes(
    actorRole,
  );
}

export function canPublishOfficialGrade(actorRole: UserRole) {
  return ["ADMIN", "MANAGER", "TEACHER"].includes(actorRole);
}

export function canSuggestGrade(actorRole: UserRole) {
  return actorRole === "TEACHING_ASSISTANT";
}
