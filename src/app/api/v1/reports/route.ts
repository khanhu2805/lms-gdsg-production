import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { createReportSchema } from "@/modules/reports/report.schemas";
import { listReports, requestReport } from "@/modules/reports/report.service";

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    return apiSuccess(await listReports(actor));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const input = createReportSchema.parse(await parseJsonBody(request));
    return apiSuccess(await requestReport(actor, input, context), {
      status: 202,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
