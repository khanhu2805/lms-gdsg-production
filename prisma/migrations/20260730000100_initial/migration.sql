-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'TEACHER', 'TEACHING_ASSISTANT', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "ClassMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "TeacherType" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'MATERIAL', 'ASSIGNMENT', 'QUIZ', 'LESSON');

-- CreateEnum
CREATE TYPE "ContentPublicationStatus" AS ENUM ('DRAFT', 'PENDING_TEACHER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED', 'REOPEN_REQUESTED', 'REOPENED', 'REJECTED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentReviewAction" AS ENUM ('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReopenRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('RECORDING', 'DOCUMENT', 'SUBMISSION', 'IMAGE', 'THUMBNAIL', 'REPORT', 'TEMP');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('UPLOADING', 'READY', 'QUARANTINED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "RecordingProcessingStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "VideoViewSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'GRADING', 'GRADED', 'RETURNED', 'RESUBMISSION_REQUIRED');

-- CreateEnum
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADING', 'GRADED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'PENDING');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('AUTO_JOIN_CLICK', 'MANUAL_ADMIN', 'MANUAL_MANAGER', 'MANUAL_TEACHER', 'MANUAL_ASSISTANT', 'SYSTEM_FINALIZED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('USERS', 'CLASSES', 'CAPACITY', 'ATTENDANCE', 'ASSIGNMENTS', 'QUIZZES', 'PROGRESS', 'VIDEO', 'STORAGE', 'FAILED_JOBS');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('PROCESS_VIDEO', 'CREATE_THUMBNAIL', 'GENERATE_HLS', 'DELETE_FILE', 'GENERATE_REPORT', 'FINALIZE_ATTENDANCE', 'CLEAN_TEMP_FILES');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PermissionCode" AS ENUM ('OVERRIDE_CLASS_CAPACITY', 'VIEW_GLOBAL_AUDIT', 'RETRY_BACKGROUND_JOB');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'INACTIVE',
    "lockedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phone" TEXT,
    "studentCode" TEXT,
    "teacherCode" TEXT,
    "assistantCode" TEXT,
    "parentCode" TEXT,
    "dateOfBirth" DATE,
    "address" TEXT,
    "bio" TEXT,
    "emergencyContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "academicYear" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "mode" "ClassMode" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "internalNote" TEXT,
    "overCapacitySince" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_teachers" (
    "id" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "type" "TeacherType" NOT NULL DEFAULT 'SECONDARY',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "class_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_assistants" (
    "id" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "assistantId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "class_assistants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_students" (
    "id" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "class_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_student_links" (
    "id" UUID NOT NULL,
    "parentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" TIMESTAMP(3),

    CONSTRAINT "parent_student_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedContent" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "mode" "ClassMode" NOT NULL,
    "room" TEXT,
    "meetingUrl" TEXT,
    "status" "ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancellationReason" TEXT,
    "attendanceOpen" BOOLEAN NOT NULL DEFAULT false,
    "attendanceOpenedAt" TIMESTAMP(3),
    "attendanceClosedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "classSessionId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "creatorRole" "UserRole" NOT NULL,
    "type" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publicationStatus" "ContentPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "publishedAt" TIMESTAMP(3),
    "reopenedById" UUID,
    "reopenedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reviews" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "action" "ContentReviewAction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reopen_requests" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReopenRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolutionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reopen_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "markdownContent" TEXT NOT NULL,
    "learningObjectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "uploadedById" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordings" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "thumbnailAssetId" UUID,
    "hlsManifestKey" TEXT,
    "processingStatus" "RecordingProcessingStatus" NOT NULL DEFAULT 'UPLOADING',
    "durationSeconds" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "codec" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_progress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordingId" UUID NOT NULL,
    "currentTimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL,
    "totalWatchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastIpAddress" TEXT,
    "lastUserAgent" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_view_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "recordingId" UUID NOT NULL,
    "status" "VideoViewSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "video_view_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "opensAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "allowLateSubmission" BOOLEAN NOT NULL DEFAULT false,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "maxScore" DECIMAL(7,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_questions" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "type" "QuestionType" NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "score" DECIMAL(7,2) NOT NULL,
    "explanation" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_choices" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "autoScore" DECIMAL(7,2),
    "manualScore" DECIMAL(7,2),
    "finalScore" DECIMAL(7,2),
    "teacherFeedback" TEXT,
    "assistantSuggestedScore" DECIMAL(7,2),
    "assistantSuggestedFeedback" TEXT,
    "gradedById" UUID,
    "gradedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_answers" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "answerText" TEXT,
    "selectedChoiceIds" JSONB,
    "autoScore" DECIMAL(7,2),
    "manualScore" DECIMAL(7,2),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_files" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleChoices" BOOLEAN NOT NULL DEFAULT false,
    "showResultAt" TIMESTAMP(3),
    "showCorrectAnswersAt" TIMESTAMP(3),
    "maxScore" DECIMAL(7,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "type" "QuestionType" NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "score" DECIMAL(7,2) NOT NULL,
    "explanation" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_choices" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "autoScore" DECIMAL(7,2),
    "manualScore" DECIMAL(7,2),
    "finalScore" DECIMAL(7,2),
    "assistantSuggestedScore" DECIMAL(7,2),
    "gradedById" UUID,
    "gradedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answers" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "answerText" TEXT,
    "selectedChoiceIds" JSONB,
    "autoScore" DECIMAL(7,2),
    "manualScore" DECIMAL(7,2),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "classSessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "source" "AttendanceSource" NOT NULL,
    "firstJoinClickedAt" TIMESTAMP(3),
    "lastJoinClickedAt" TIMESTAMP(3),
    "markedById" UUID,
    "markedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_audits" (
    "id" UUID NOT NULL,
    "attendanceId" UUID NOT NULL,
    "actorId" UUID,
    "actorRole" "UserRole" NOT NULL,
    "oldStatus" "AttendanceStatus",
    "newStatus" "AttendanceStatus" NOT NULL,
    "oldNote" TEXT,
    "newNote" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "type" "ReportType" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "parameters" JSONB NOT NULL,
    "requestedById" UUID NOT NULL,
    "fileAssetId" UUID,
    "jobId" UUID,
    "errorMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "type" "JobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "errorMessage" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorRole" "UserRole" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_grants" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permission" "PermissionCode" NOT NULL,
    "scopeClassId" UUID,
    "reason" TEXT NOT NULL,
    "grantedById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_studentCode_key" ON "profiles"("studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_teacherCode_key" ON "profiles"("teacherCode");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_assistantCode_key" ON "profiles"("assistantCode");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_parentCode_key" ON "profiles"("parentCode");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_providerId_accountId_key" ON "auth_accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE INDEX "subjects_isActive_name_idx" ON "subjects"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "classes_code_key" ON "classes"("code");

-- CreateIndex
CREATE INDEX "classes_status_startDate_endDate_idx" ON "classes"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "classes_subjectId_academicYear_idx" ON "classes"("subjectId", "academicYear");

-- CreateIndex
CREATE INDEX "class_teachers_teacherId_status_idx" ON "class_teachers"("teacherId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "class_teachers_classId_teacherId_key" ON "class_teachers"("classId", "teacherId");

-- CreateIndex
CREATE INDEX "class_assistants_assistantId_status_idx" ON "class_assistants"("assistantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "class_assistants_classId_assistantId_key" ON "class_assistants"("classId", "assistantId");

-- CreateIndex
CREATE INDEX "class_students_studentId_status_idx" ON "class_students"("studentId", "status");

-- CreateIndex
CREATE INDEX "class_students_classId_status_idx" ON "class_students"("classId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "class_students_classId_studentId_key" ON "class_students"("classId", "studentId");

-- CreateIndex
CREATE INDEX "parent_student_links_studentId_status_idx" ON "parent_student_links"("studentId", "status");

-- CreateIndex
CREATE INDEX "parent_student_links_parentId_status_idx" ON "parent_student_links"("parentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "parent_student_links_parentId_studentId_key" ON "parent_student_links"("parentId", "studentId");

-- CreateIndex
CREATE INDEX "class_sessions_classId_startAt_idx" ON "class_sessions"("classId", "startAt");

-- CreateIndex
CREATE INDEX "class_sessions_status_startAt_endAt_idx" ON "class_sessions"("status", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_classId_sessionNumber_key" ON "class_sessions"("classId", "sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "contents_previousVersionId_key" ON "contents"("previousVersionId");

-- CreateIndex
CREATE INDEX "contents_classId_classSessionId_publicationStatus_idx" ON "contents"("classId", "classSessionId", "publicationStatus");

-- CreateIndex
CREATE INDEX "contents_creatorId_publicationStatus_idx" ON "contents"("creatorId", "publicationStatus");

-- CreateIndex
CREATE INDEX "contents_type_publicationStatus_publishedAt_idx" ON "contents"("type", "publicationStatus", "publishedAt");

-- CreateIndex
CREATE INDEX "content_reviews_contentId_createdAt_idx" ON "content_reviews"("contentId", "createdAt");

-- CreateIndex
CREATE INDEX "content_reviews_reviewerId_createdAt_idx" ON "content_reviews"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "content_reopen_requests_contentId_status_idx" ON "content_reopen_requests"("contentId", "status");

-- CreateIndex
CREATE INDEX "content_reopen_requests_status_createdAt_idx" ON "content_reopen_requests"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_contentId_key" ON "lessons"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_storageKey_key" ON "assets"("storageKey");

-- CreateIndex
CREATE INDEX "assets_category_status_createdAt_idx" ON "assets"("category", "status", "createdAt");

-- CreateIndex
CREATE INDEX "assets_uploadedById_createdAt_idx" ON "assets"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "assets_deletedAt_idx" ON "assets"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recordings_contentId_key" ON "recordings"("contentId");

-- CreateIndex
CREATE INDEX "recordings_assetId_idx" ON "recordings"("assetId");

-- CreateIndex
CREATE INDEX "recordings_thumbnailAssetId_idx" ON "recordings"("thumbnailAssetId");

-- CreateIndex
CREATE INDEX "recordings_processingStatus_createdAt_idx" ON "recordings"("processingStatus", "createdAt");

-- CreateIndex
CREATE INDEX "video_progress_recordingId_completed_idx" ON "video_progress"("recordingId", "completed");

-- CreateIndex
CREATE UNIQUE INDEX "video_progress_userId_recordingId_key" ON "video_progress"("userId", "recordingId");

-- CreateIndex
CREATE INDEX "video_view_sessions_userId_status_lastSeenAt_idx" ON "video_view_sessions"("userId", "status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "video_view_sessions_recordingId_startedAt_idx" ON "video_view_sessions"("recordingId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "materials_contentId_key" ON "materials"("contentId");

-- CreateIndex
CREATE INDEX "materials_assetId_idx" ON "materials"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_contentId_key" ON "assignments"("contentId");

-- CreateIndex
CREATE INDEX "assignments_opensAt_dueAt_idx" ON "assignments"("opensAt", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_questions_assignmentId_order_key" ON "assignment_questions"("assignmentId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_choices_questionId_order_key" ON "assignment_choices"("questionId", "order");

-- CreateIndex
CREATE INDEX "submissions_studentId_status_idx" ON "submissions"("studentId", "status");

-- CreateIndex
CREATE INDEX "submissions_assignmentId_status_submittedAt_idx" ON "submissions"("assignmentId", "status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignmentId_studentId_attemptNumber_key" ON "submissions"("assignmentId", "studentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "submission_answers_submissionId_questionId_key" ON "submission_answers"("submissionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_files_assetId_key" ON "submission_files"("assetId");

-- CreateIndex
CREATE INDEX "submission_files_submissionId_idx" ON "submission_files"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_contentId_key" ON "quizzes"("contentId");

-- CreateIndex
CREATE INDEX "quizzes_opensAt_closesAt_idx" ON "quizzes"("opensAt", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_quizId_order_key" ON "quiz_questions"("quizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_choices_questionId_order_key" ON "quiz_choices"("questionId", "order");

-- CreateIndex
CREATE INDEX "quiz_attempts_studentId_status_idx" ON "quiz_attempts"("studentId", "status");

-- CreateIndex
CREATE INDEX "quiz_attempts_quizId_status_submittedAt_idx" ON "quiz_attempts"("quizId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "quiz_attempts_status_expiresAt_idx" ON "quiz_attempts"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempts_quizId_studentId_attemptNumber_key" ON "quiz_attempts"("quizId", "studentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_answers_attemptId_questionId_key" ON "quiz_answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "attendance_studentId_createdAt_idx" ON "attendance"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "attendance_classSessionId_status_idx" ON "attendance"("classSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_classSessionId_studentId_key" ON "attendance"("classSessionId", "studentId");

-- CreateIndex
CREATE INDEX "attendance_audits_attendanceId_createdAt_idx" ON "attendance_audits"("attendanceId", "createdAt");

-- CreateIndex
CREATE INDEX "attendance_audits_actorId_createdAt_idx" ON "attendance_audits"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "reports_requestedById_status_createdAt_idx" ON "reports"("requestedById", "status", "createdAt");

-- CreateIndex
CREATE INDEX "reports_status_expiresAt_idx" ON "reports"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "jobs_status_scheduledAt_idx" ON "jobs"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "jobs_lockedAt_idx" ON "jobs"("lockedAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");

-- CreateIndex
CREATE INDEX "permission_grants_userId_permission_revokedAt_expiresAt_idx" ON "permission_grants"("userId", "permission", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "permission_grants_scopeClassId_permission_idx" ON "permission_grants"("scopeClassId", "permission");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_assistants" ADD CONSTRAINT "class_assistants_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_assistants" ADD CONSTRAINT "class_assistants_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_students" ADD CONSTRAINT "class_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reopen_requests" ADD CONSTRAINT "content_reopen_requests_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reopen_requests" ADD CONSTRAINT "content_reopen_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reopen_requests" ADD CONSTRAINT "content_reopen_requests_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_thumbnailAssetId_fkey" FOREIGN KEY ("thumbnailAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "recordings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_view_sessions" ADD CONSTRAINT "video_view_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_view_sessions" ADD CONSTRAINT "video_view_sessions_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "recordings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_questions" ADD CONSTRAINT "assignment_questions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_choices" ADD CONSTRAINT "assignment_choices_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "assignment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "assignment_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_choices" ADD CONSTRAINT "quiz_choices_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audits" ADD CONSTRAINT "attendance_audits_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_audits" ADD CONSTRAINT "attendance_audits_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_grants" ADD CONSTRAINT "permission_grants_scopeClassId_fkey" FOREIGN KEY ("scopeClassId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Better Auth uses PostgreSQL-backed rate limiting so multiple app instances
-- share a single limit state.
CREATE TABLE "auth_rate_limits" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_rate_limits_key_key" ON "auth_rate_limits"("key");

-- Domain integrity constraints that cannot be expressed by Prisma attributes.
ALTER TABLE "classes"
  ADD CONSTRAINT "classes_capacity_positive" CHECK ("capacity" > 0),
  ADD CONSTRAINT "classes_date_range_valid" CHECK ("startDate" <= "endDate"),
  ADD CONSTRAINT "classes_version_positive" CHECK ("version" > 0);

ALTER TABLE "class_sessions"
  ADD CONSTRAINT "class_sessions_time_range_valid" CHECK ("startAt" < "endAt");

ALTER TABLE "contents"
  ADD CONSTRAINT "contents_version_positive" CHECK ("version" > 0);

ALTER TABLE "assignments"
  ADD CONSTRAINT "assignments_attempts_positive" CHECK ("maxAttempts" > 0),
  ADD CONSTRAINT "assignments_score_nonnegative" CHECK ("maxScore" >= 0),
  ADD CONSTRAINT "assignments_window_valid" CHECK ("opensAt" IS NULL OR "dueAt" IS NULL OR "opensAt" <= "dueAt");

ALTER TABLE "assignment_questions"
  ADD CONSTRAINT "assignment_questions_order_positive" CHECK ("order" > 0),
  ADD CONSTRAINT "assignment_questions_score_nonnegative" CHECK ("score" >= 0);

ALTER TABLE "quizzes"
  ADD CONSTRAINT "quizzes_duration_positive" CHECK ("durationMinutes" > 0),
  ADD CONSTRAINT "quizzes_attempts_positive" CHECK ("maxAttempts" > 0),
  ADD CONSTRAINT "quizzes_score_nonnegative" CHECK ("maxScore" >= 0),
  ADD CONSTRAINT "quizzes_window_valid" CHECK ("opensAt" IS NULL OR "closesAt" IS NULL OR "opensAt" < "closesAt");

ALTER TABLE "quiz_questions"
  ADD CONSTRAINT "quiz_questions_order_positive" CHECK ("order" > 0),
  ADD CONSTRAINT "quiz_questions_score_nonnegative" CHECK ("score" >= 0);

ALTER TABLE "video_progress"
  ADD CONSTRAINT "video_progress_time_nonnegative" CHECK (
    "currentTimeSeconds" >= 0 AND "durationSeconds" > 0 AND "totalWatchedSeconds" >= 0
  ),
  ADD CONSTRAINT "video_progress_percentage_valid" CHECK ("percentage" >= 0 AND "percentage" <= 100);

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_attempts_valid" CHECK (
    "attempts" >= 0 AND "maxAttempts" > 0 AND "attempts" <= "maxAttempts"
  );

-- A class has at most one active primary teacher and a student has at most one
-- active primary parent. Historical rows remain intact.
CREATE UNIQUE INDEX "class_teachers_one_active_primary"
  ON "class_teachers" ("classId")
  WHERE "type" = 'PRIMARY' AND "status" = 'ACTIVE';

CREATE UNIQUE INDEX "parent_links_one_active_primary"
  ON "parent_student_links" ("studentId")
  WHERE "isPrimary" = true AND "status" = 'ACTIVE';

-- Content must always belong to the same class as its session.
CREATE OR REPLACE FUNCTION "assert_content_session_class"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "class_sessions" s
    WHERE s."id" = NEW."classSessionId"
      AND s."classId" = NEW."classId"
  ) THEN
    RAISE EXCEPTION 'Content class and class session do not match'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "contents_session_class_guard"
  BEFORE INSERT OR UPDATE OF "classId", "classSessionId"
  ON "contents"
  FOR EACH ROW
  EXECUTE FUNCTION "assert_content_session_class"();

-- Audit history is append-only at database level.
CREATE OR REPLACE FUNCTION "prevent_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Historical audit records are append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "audit_logs_immutable"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_history_mutation"();

CREATE TRIGGER "attendance_audits_immutable"
  BEFORE UPDATE OR DELETE ON "attendance_audits"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_history_mutation"();
