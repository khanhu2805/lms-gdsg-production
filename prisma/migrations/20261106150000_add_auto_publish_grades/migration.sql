ALTER TABLE "assignments" ADD COLUMN "autoPublishGrades" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "quizzes" ADD COLUMN "autoPublishGrades" BOOLEAN NOT NULL DEFAULT false;
