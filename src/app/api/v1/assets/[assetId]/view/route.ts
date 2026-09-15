import { requireActor } from "@/lib/auth/actor";
import { apiError } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getRequestContext } from "@/lib/security/request-context";
import { authorizeAssetDownload } from "@/lib/storage/asset-authorization";

const INLINE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const context = getRequestContext(request.headers);

  try {
    const actor = await requireActor(request.headers);
    const { assetId } = await params;

    const asset = await authorizeAssetDownload(actor, assetId);

    if (!INLINE_TYPES.has(asset.mimeType)) {
      throw new AppError(
        "CONFLICT",
        "Định dạng tài liệu này cần bản xem trước PDF.",
      );
    }

    return new Response(null, {
      status: 200,
      headers: {
        "X-Accel-Redirect": asset.internalPath,
        "Content-Type": asset.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          asset.originalName,
        )}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}