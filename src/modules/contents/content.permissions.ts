import type {
  ContentPublicationStatus,
  UserRole,
} from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors/app-error";

import type { ContentAction, ContentSnapshot } from "./content.types";

const creatorEditableStatuses: readonly ContentPublicationStatus[] = [
  "DRAFT",
  "CHANGES_REQUESTED",
  "REOPENED",
];

const administratorEditableStatuses: readonly ContentPublicationStatus[] = [
  "DRAFT",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REOPENED",
];

export function canEditContent(
  actor: { id: string; role: UserRole },
  content: ContentSnapshot,
) {
  if (actor.role === "ADMIN" || actor.role === "MANAGER") {
    return administratorEditableStatuses.includes(content.publicationStatus);
  }
  return (
    actor.id === content.creatorId &&
    creatorEditableStatuses.includes(content.publicationStatus)
  );
}

export function resolveContentTransition(
  actor: { id: string; role: UserRole },
  content: ContentSnapshot,
  action: ContentAction,
): ContentPublicationStatus {
  const isAdministrator = actor.role === "ADMIN" || actor.role === "MANAGER";
  const isCreator = actor.id === content.creatorId;
  const isTeacher = actor.role === "TEACHER";
  const isAssistant = actor.role === "TEACHING_ASSISTANT";
  const status = content.publicationStatus;

  if (
    action === "SUBMIT_REVIEW" &&
    isAssistant &&
    isCreator &&
    creatorEditableStatuses.includes(status)
  ) {
    return "PENDING_TEACHER_REVIEW";
  }

  if (
    action === "APPROVE" &&
    (isTeacher || isAdministrator) &&
    content.creatorRole === "TEACHING_ASSISTANT" &&
    status === "PENDING_TEACHER_REVIEW"
  ) {
    return "APPROVED";
  }

  if (
    action === "REQUEST_CHANGES" &&
    (isTeacher || isAdministrator) &&
    content.creatorRole === "TEACHING_ASSISTANT" &&
    status === "PENDING_TEACHER_REVIEW"
  ) {
    return "CHANGES_REQUESTED";
  }

  if (
    action === "REJECT" &&
    (isTeacher || isAdministrator) &&
    content.creatorRole === "TEACHING_ASSISTANT" &&
    status === "PENDING_TEACHER_REVIEW"
  ) {
    return "REJECTED";
  }

  if (action === "PUBLISH") {
    const teacherCanPublish =
      isTeacher &&
      isCreator &&
      content.creatorRole === "TEACHER" &&
      creatorEditableStatuses.includes(status);
    const assistantCanPublish =
      isAssistant &&
      isCreator &&
      content.creatorRole === "TEACHING_ASSISTANT" &&
      status === "APPROVED";
    const administratorCanPublish =
      isAdministrator &&
      ["DRAFT", "CHANGES_REQUESTED", "APPROVED", "REOPENED"].includes(status);

    if (teacherCanPublish || assistantCanPublish || administratorCanPublish) {
      return "PUBLISHED";
    }
  }

  if (
    action === "REQUEST_REOPEN" &&
    isCreator &&
    ["TEACHER", "TEACHING_ASSISTANT"].includes(actor.role) &&
    status === "PUBLISHED"
  ) {
    return "REOPEN_REQUESTED";
  }

  if (action === "REOPEN" && isAdministrator && status === "REOPEN_REQUESTED") {
    return "REOPENED";
  }

  if (
    action === "REJECT_REOPEN" &&
    isAdministrator &&
    status === "REOPEN_REQUESTED"
  ) {
    return "PUBLISHED";
  }

  if (action === "HIDE" && isAdministrator && status === "PUBLISHED") {
    return "HIDDEN";
  }

  if (
    action === "ARCHIVE" &&
    isAdministrator &&
    !["PUBLISHED", "ARCHIVED"].includes(status)
  ) {
    return "ARCHIVED";
  }

  throw new AppError(
    "CONFLICT",
    "Trạng thái nội dung không cho phép thao tác này.",
  );
}
