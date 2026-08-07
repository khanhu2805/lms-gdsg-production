import { z } from "zod";

import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { listAccessibleContents } from "@/modules/contents/content.repository";
import { createContentSchema } from "@/modules/contents/content.schemas";
import { createContent } from "@/modules/contents/content.service";

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const url = new URL(request.url);
    const classId = z.uuid().parse(url.searchParams.get("classId"));
    const classSessionId = z
      .uuid()
      .optional()
      .parse(url.searchParams.get("classSessionId") ?? undefined);
    const contents = await listAccessibleContents(actor, {
      classId,
      classSessionId,
    });
    return apiSuccess(
      contents.map((content) => ({
        ...content,
        material: content.material
          ? {
              ...content.material,
              sizeBytes: content.material.sizeBytes.toString(),
            }
          : null,
      })),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const input = createContentSchema.parse(await parseJsonBody(request));
    return apiSuccess(await createContent(actor, input, context), {
      status: 201,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
