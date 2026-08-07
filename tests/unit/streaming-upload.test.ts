import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let uploadRoot: string;

function mp4Fixture() {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftypisom"),
    Buffer.from([0x00, 0x00, 0x02, 0x00]),
    Buffer.from("isomiso2avc1mp41"),
  ]);
}

function bodyFrom(buffer: Buffer) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(buffer);
      controller.close();
    },
  });
}

beforeAll(async () => {
  uploadRoot = await mkdtemp(path.join(tmpdir(), "lms-stream-upload-"));
  process.env.UPLOAD_ROOT = uploadRoot;
  process.env.RECORDINGS_DIR = path.join(uploadRoot, "recordings");
  process.env.DOCUMENTS_DIR = path.join(uploadRoot, "documents");
  process.env.SUBMISSIONS_DIR = path.join(uploadRoot, "submissions");
  process.env.IMAGES_DIR = path.join(uploadRoot, "images");
  process.env.THUMBNAILS_DIR = path.join(uploadRoot, "thumbnails");
  process.env.REPORTS_DIR = path.join(uploadRoot, "reports");
  process.env.TEMP_DIR = path.join(uploadRoot, "temp");
  process.env.MAX_VIDEO_SIZE_MB = "1";
  vi.resetModules();
});

afterAll(async () => {
  await rm(uploadRoot, { recursive: true, force: true });
});

describe("streaming video upload", () => {
  it("kiểm tra chữ ký, tính checksum và lưu ngoài web root", async () => {
    const { persistStreamingVideoUpload } =
      await import("@/lib/storage/file-policy");
    const video = mp4Fixture();
    const result = await persistStreamingVideoUpload({
      body: bodyFrom(video),
      originalName: "lesson.mp4",
      claimedMimeType: "video/mp4",
      declaredSize: video.byteLength,
    });

    expect(result.mimeType).toBe("video/mp4");
    expect(result.sizeBytes).toBe(BigInt(video.byteLength));
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(path.join(uploadRoot, result.storageKey))).toEqual(
      video,
    );
  });

  it("xóa file tạm khi kích thước khai báo không khớp", async () => {
    const { persistStreamingVideoUpload } =
      await import("@/lib/storage/file-policy");
    const video = mp4Fixture();

    await expect(
      persistStreamingVideoUpload({
        body: bodyFrom(video),
        originalName: "lesson.mp4",
        claimedMimeType: "video/mp4",
        declaredSize: video.byteLength + 1,
      }),
    ).rejects.toThrow("Dung lượng video không khớp");

    expect(await readdir(path.join(uploadRoot, "temp"))).toEqual([]);
  });
});
