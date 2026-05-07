import { expect, test } from "@playwright/test";

test.describe("public login surface", () => {
  test("login page exposes credentials form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Continue$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/login/forgot-password",
    );
  });

  test("forgot-password page exposes email form", async ({ page }) => {
    await page.goto("/login/forgot-password");
    await expect(page.getByRole("heading", { name: /forgot password/i })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/login");
  });
});
