import { requireActor } from "@/lib/auth/actor";
import { apiError } from "@/lib/errors/api-response";
import { getRequestContext } from "@/lib/security/request-context";
import { authorizeAssetDownload } from "@/lib/storage/asset-authorization";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { assetId } = await params;
    const asset = await authorizeAssetDownload(actor, assetId);
    return new Response(null, {
      status: 204,
      headers: {
        "X-Accel-Redirect": asset.internalPath,
        "Content-Type": asset.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
