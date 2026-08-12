import { describe, expect, it } from "vitest";

import {
  parseDashboardPage,
  parseDashboardPageSize,
} from "@/modules/dashboard/query-options";

describe("dashboard query options", () => {
  it("mặc định ở trang 1 và 20 mục", () => {
    expect(parseDashboardPage(undefined)).toBe(1);
    expect(parseDashboardPageSize(undefined)).toBe(20);
  });

  it("chấp nhận số trang dương", () => {
    expect(parseDashboardPage("3")).toBe(3);
  });

  it("không chấp nhận trang âm, 0 hoặc chuỗi sai", () => {
    expect(parseDashboardPage("0")).toBe(1);
    expect(parseDashboardPage("-4")).toBe(1);
    expect(parseDashboardPage("abc")).toBe(1);
  });

  it("chỉ chấp nhận page size đã quy định", () => {
    expect(parseDashboardPageSize("20")).toBe(20);
    expect(parseDashboardPageSize("50")).toBe(50);
    expect(parseDashboardPageSize("100")).toBe(100);
    expect(parseDashboardPageSize("1000")).toBe(20);
  });
});
