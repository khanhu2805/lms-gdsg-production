import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import type { UserRole } from "@/generated/prisma/enums";
import { testAuth } from "@/lib/auth/auth.test";
import { prisma } from "@/lib/database/client";

const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL?.trim();

const CASES: Array<{
  role: UserRole;
  roleLabel: string;
  navigationLabel: string;
}> = [
  { role: "ADMIN", roleLabel: "Quản trị viên", navigationLabel: "Tài khoản" },
  { role: "MANAGER", roleLabel: "Quản lý", navigationLabel: "Lớp học" },
  { role: "TEACHER", roleLabel: "Giáo viên", navigationLabel: "Lớp phụ trách" },
  {
    role: "TEACHING_ASSISTANT",
    roleLabel: "Trợ giảng",
    navigationLabel: "Lớp được giao",
  },
  { role: "STUDENT", roleLabel: "Học sinh", navigationLabel: "Lớp học" },
  { role: "PARENT", roleLabel: "Phụ huynh", navigationLabel: "Con của tôi" },
];

test.describe("dashboard authenticated theo 6 vai trò", () => {
  test.skip(
    !E2E_DATABASE_URL,
    "Cần E2E_DATABASE_URL trỏ tới PostgreSQL test đã migrate.",
  );
  test.describe.configure({ mode: "serial" });

  for (const item of CASES) {
    test(`${item.role} có session thật và thấy đúng navigation`, async ({
      context,
      page,
    }) => {
      const authContext = await testAuth.$context;
      const helpers = authContext.test;
      const suffix = randomUUID();
      const name = `E2E ${item.role} ${suffix.slice(0, 8)}`;
      const user = helpers.createUser({
        email: `e2e-${item.role.toLowerCase()}-${suffix}@example.com`,
        id: randomUUID(),
        emailVerified: true,
      });

      const saved = await helpers.saveUser(user);
      await prisma.user.update({
        where: { id: saved.id },
        data: {
          role: item.role,
          status: "ACTIVE",
          name: name,
          emailVerified: true,
          lockedAt: null,
          deletedAt: null,
        },
      });

      try {
        const baseURL =
          process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000";
        const login = await helpers.login({ userId: saved.id });
        expect(login.user.id).toBe(saved.id);

        const hostname = new URL(baseURL).hostname;
        const cookies = login.cookies.map((cookie) => ({
          ...cookie,
          domain: hostname,
        }));
        await context.addCookies(cookies);

        const sessionResponse = await context.request.get(
          `${baseURL}/api/auth/get-session`,
        );
        expect(sessionResponse.ok()).toBeTruthy();
        const browserSession = (await sessionResponse.json()) as {
          user?: { id?: string };
        };
        expect(browserSession.user?.id).toBe(saved.id);

        const dashboardResponse = await page.goto("/dashboard");
        expect(
          dashboardResponse,
          "Dashboard phải có HTTP response",
        ).not.toBeNull();
        expect(
          dashboardResponse!.status(),
          `Dashboard HTTP ${dashboardResponse!.status()}`,
        ).toBeLessThan(400);
        await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);

        const expectedHeading = page.getByRole("heading", {
          name: `Xin chào, ${name}`,
        });

        try {
          await expect(expectedHeading).toBeVisible({ timeout: 10_000 });
        } catch (error) {
          const bodyText = (await page.locator("body").innerText())
            .replace(/\s+/g, " ")
            .slice(0, 4000);
          const headings = await page.locator("h1, h2, h3").allTextContents();
          throw new Error(
            [
              `Dashboard render diagnostic for ${item.role}`,
              `URL: ${page.url()}`,
              `HTTP: ${dashboardResponse!.status()}`,
              `Headings: ${JSON.stringify(headings)}`,
              `Body: ${bodyText}`,
              `Original assertion: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ].join("\n"),
          );
        }
        await expect(page.getByText(item.roleLabel).first()).toBeVisible();
        const navigationLink = page
          .getByRole("link", { name: item.navigationLabel })
          .first();

        if (!(await navigationLink.isVisible())) {
          const openMenuButton = page.getByRole("button", { name: "Mở menu" });
          await expect(openMenuButton).toBeVisible();
          await openMenuButton.click();
        }

        await expect(
          page.getByRole("link", { name: item.navigationLabel }).first(),
        ).toBeVisible();
      } finally {
        await prisma.session.deleteMany({ where: { userId: saved.id } });
        await helpers.deleteUser(saved.id);
      }
    });
  }
});
