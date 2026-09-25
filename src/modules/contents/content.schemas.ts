import { z } from "zod";

export const contentActionSchema = z.object({
  action: z.enum([
    "SUBMIT_REVIEW",
    "APPROVE",
    "REQUEST_CHANGES",
    "REJECT",
    "PUBLISH",
    "REQUEST_REOPEN",
    "REOPEN",
    "REJECT_REOPEN",
    "HIDE",
    "ARCHIVE",
  ]),
  comment: z.string().trim().max(2000).optional(),
  reason: z.string().trim().max(2000).optional(),
});

const contentBase = z.object({
  classId: z.uuid(),
  classSessionId: z.uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
});

const choiceSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean().default(false),
  order: z.number().int().min(1),
});

const questionSchema = z
  .object({
    type: z.enum([
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
      "SHORT_ANSWER",
      "ESSAY",
      "FILE_UPLOAD",
    ]),
    content: z.string().trim().min(1).max(20_000),
    order: z.number().int().min(1),
    score: z.number().min(0).max(10_000),
    explanation: z.string().trim().max(20_000).optional(),
    required: z.boolean().default(true),
    choices: z.array(choiceSchema).max(20).default([]),
  })
  .superRefine((question, context) => {
    const objective = [
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
    ].includes(question.type);

    if (objective && question.choices.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Câu hỏi trắc nghiệm phải có ít nhất hai lựa chọn.",
      });
    }

    const correctChoiceCount = question.choices.filter(
      (choice) => choice.isCorrect,
    ).length;

    if (
      ["SINGLE_CHOICE", "TRUE_FALSE"].includes(question.type) &&
      correctChoiceCount !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Câu hỏi một lựa chọn phải có đúng một đáp án đúng.",
      });
    }

    if (question.type === "MULTIPLE_CHOICE" && correctChoiceCount < 1) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Câu hỏi nhiều đáp án phải có ít nhất một đáp án đúng.",
      });
    }

    if (!objective && question.choices.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Câu tự luận hoặc tải file không được có lựa chọn.",
      });
    }

    const orders = question.choices.map((choice) => choice.order);
    if (new Set(orders).size !== orders.length) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Thứ tự lựa chọn không được trùng.",
      });
    }
  });

function uniqueQuestionOrder(
  value: { questions: Array<{ order: number }> },
  context: z.RefinementCtx,
) {
  const orders = value.questions.map((question) => question.order);
  if (new Set(orders).size !== orders.length) {
    context.addIssue({
      code: "custom",
      path: ["questions"],
      message: "Thứ tự câu hỏi không được trùng.",
    });
  }
}

export const createContentSchema = z.discriminatedUnion("type", [
  contentBase.extend({
    type: z.literal("LESSON"),
    payload: z.object({
      markdownContent: z.string().min(1).max(200_000),
      learningObjectives: z.array(z.string().trim().min(1).max(500)).max(30),
    }),
  }),
  contentBase.extend({
    type: z.literal("MATERIAL"),
    payload: z.object({
      assetId: z.uuid(),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(4000).nullable().optional(),
    }),
  }),
  contentBase.extend({
    type: z.literal("VIDEO"),
    payload: z.object({
      assetId: z.uuid(),
    }),
  }),
  contentBase.extend({
    type: z.literal("ASSIGNMENT"),
    payload: z
      .object({
        opensAt: z.coerce.date().nullable().optional(),
        dueAt: z.coerce.date().nullable().optional(),
        allowLateSubmission: z.boolean().default(false),
        maxAttempts: z.number().int().min(1).max(20).default(1),
        maxScore: z.number().min(0).max(100_000),
        questions: z.array(questionSchema).min(1).max(200),
      })
      .refine(
        (value) =>
          !value.opensAt || !value.dueAt || value.opensAt <= value.dueAt,
        {
          path: ["dueAt"],
          message: "Hạn nộp phải sau thời điểm mở.",
        },
      )
      .superRefine(uniqueQuestionOrder),
  }),
  contentBase.extend({
    type: z.literal("QUIZ"),
    payload: z
      .object({
        opensAt: z.coerce.date().nullable().optional(),
        closesAt: z.coerce.date().nullable().optional(),
        durationMinutes: z.number().int().min(1).max(1440),
        maxAttempts: z.number().int().min(1).max(20).default(1),
        shuffleQuestions: z.boolean().default(false),
        shuffleChoices: z.boolean().default(false),
        showResultAt: z.coerce.date().nullable().optional(),
        showCorrectAnswersAt: z.coerce.date().nullable().optional(),
        maxScore: z.number().min(0).max(100_000),
        questions: z.array(questionSchema).min(1).max(200),
      })
      .refine(
        (value) =>
          !value.opensAt || !value.closesAt || value.opensAt < value.closesAt,
        {
          path: ["closesAt"],
          message: "Thời điểm đóng phải sau thời điểm mở.",
        },
      )
      .superRefine((value, context) => {
        uniqueQuestionOrder(value, context);
        if (
          value.questions.some((question) => question.type === "FILE_UPLOAD")
        ) {
          context.addIssue({
            code: "custom",
            path: ["questions"],
            message: "Quiz không hỗ trợ câu hỏi tải file.",
          });
        }
        if (
          value.showResultAt &&
          value.showCorrectAnswersAt &&
          value.showCorrectAnswersAt < value.showResultAt
        ) {
          context.addIssue({
            code: "custom",
            path: ["showCorrectAnswersAt"],
            message: "Không thể hiện đáp án trước thời điểm hiện kết quả.",
          });
        }
      }),
  }),
]);

export const updateContentSchema = z.intersection(
  createContentSchema,
  z.object({
    expectedUpdatedAt: z.coerce.date(),
    reason: z.string().trim().min(3).max(1000),
  }),
);

export const purgeContentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Vui lòng nhập lý do xóa.")
    .max(1000),
});