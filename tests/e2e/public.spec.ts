import { expect, test } from "@playwright/test";

test("health endpoint phản hồi không cache", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("màn hình đăng nhập chỉ cung cấp Google", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập LMS GDSG" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tiếp tục với Google" }),
  ).toBeVisible();
  await expect(page.getByText(/không hỗ trợ tự đăng ký/i)).toBeVisible();
});
