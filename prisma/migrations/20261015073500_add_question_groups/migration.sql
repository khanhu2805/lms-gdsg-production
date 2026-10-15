-- CreateTable
CREATE TABLE "assignment_question_groups" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_question_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_question_groups" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_question_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "assignment_questions"
ADD COLUMN "groupId" UUID,
ADD COLUMN "groupOrder" INTEGER;

-- AlterTable
ALTER TABLE "quiz_questions"
ADD COLUMN "groupId" UUID,
ADD COLUMN "groupOrder" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "assignment_question_groups_assignmentId_order_key"
ON "assignment_question_groups"("assignmentId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_question_groups_quizId_order_key"
ON "quiz_question_groups"("quizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "assignment_questions_groupId_groupOrder_key"
ON "assignment_questions"("groupId", "groupOrder");

-- CreateIndex
CREATE INDEX "assignment_questions_groupId_idx"
ON "assignment_questions"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_groupId_groupOrder_key"
ON "quiz_questions"("groupId", "groupOrder");

-- CreateIndex
CREATE INDEX "quiz_questions_groupId_idx"
ON "quiz_questions"("groupId");

-- AddForeignKey
ALTER TABLE "assignment_question_groups"
ADD CONSTRAINT "assignment_question_groups_assignmentId_fkey"
FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_question_groups"
ADD CONSTRAINT "quiz_question_groups_quizId_fkey"
FOREIGN KEY ("quizId") REFERENCES "quizzes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_questions"
ADD CONSTRAINT "assignment_questions_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "assignment_question_groups"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions"
ADD CONSTRAINT "quiz_questions_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "quiz_question_groups"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
