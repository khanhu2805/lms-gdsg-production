import { z } from "zod";

const meetingUrlSchema = z
  .url()
  .max(2000)
  .refine(
    (value) => {
      const url = new URL(value);
      return url.protocol === "https:";
    },
    { message: "Link phòng học phải là URL HTTPS" },
  );

const baseSessionFields = {
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional(),
  plannedContent: z.string().trim().max(8000).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
  room: z.string().trim().max(200).optional(),
  meetingUrl: meetingUrlSchema.optional(),
};

export const createClassSessionSchema = z
  .object({
    classId: z.uuid(),
    sessionNumber: z.coerce.number().int().min(1),
    ...baseSessionFields,
  })
  .refine((value) => value.startAt < value.endAt, {
    path: ["endAt"],
    message: "Giờ kết thúc phải sau giờ bắt đầu.",
  });

export const updateClassSessionSchema = z
  .object({
    title: baseSessionFields.title.optional(),
    description: baseSessionFields.description.nullable(),
    plannedContent: baseSessionFields.plannedContent.nullable(),
    startAt: baseSessionFields.startAt.optional(),
    endAt: baseSessionFields.endAt.optional(),
    mode: baseSessionFields.mode.optional(),
    room: baseSessionFields.room.nullable(),
    meetingUrl: baseSessionFields.meetingUrl.nullable(),
    reason: z.string().trim().min(3).max(1000),
  })
  .refine(
    (value) => !value.startAt || !value.endAt || value.startAt < value.endAt,
    {
      path: ["endAt"],
      message: "Giờ kết thúc phải sau giờ bắt đầu.",
    },
  );

export const sessionOperationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CANCEL"),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.enum(["OPEN_ATTENDANCE", "CLOSE_ATTENDANCE"]),
    reason: z.string().trim().min(3).max(1000),
  }),
]);
