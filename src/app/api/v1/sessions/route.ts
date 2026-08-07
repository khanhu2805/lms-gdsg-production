import { z } from "zod";

import { requireActor, requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { createClassSessionSchema } from "@/modules/sessions/session.schemas";
import {
  createClassSession,
  listAccessibleSessions,
} from "@/modules/sessions/session.service";

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const classId = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("classId"));
    return apiSuccess(await listAccessibleSessions(actor, classId));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const input = createClassSessionSchema.parse(await parseJsonBody(request));
    const session = await createClassSession(actor, input, context);
    return apiSuccess(session, { status: 201 });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
