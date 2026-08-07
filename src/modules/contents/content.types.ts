import type {
  ContentPublicationStatus,
  UserRole,
} from "@/generated/prisma/enums";

export type ContentAction =
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

export type ContentSnapshot = {
  id: string;
  creatorId: string;
  creatorRole: UserRole;
  publicationStatus: ContentPublicationStatus;
  previousVersionId?: string | null;
};
