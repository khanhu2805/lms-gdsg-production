import { describe, expect, it } from "vitest";
import { shouldAutoPublishOnSubmit } from "@/modules/grading/publishing";
describe("automatic grade publication", () => {
  it("requires opt-in, final submission and no human grading", () => {
    expect(shouldAutoPublishOnSubmit(false, false, true)).toBe(false);
    expect(shouldAutoPublishOnSubmit(true, false, false)).toBe(false);
    expect(shouldAutoPublishOnSubmit(true, true, true)).toBe(false);
    expect(shouldAutoPublishOnSubmit(true, false, true)).toBe(true);
  });
});
