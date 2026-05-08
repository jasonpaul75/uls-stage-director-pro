import { expect, test } from "@playwright/test";

test.describe("public surfaces", () => {
  test("home renders headline and shortcuts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /uls stage director pro/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /director dashboard/i })).toHaveAttribute("href", "/portal");
    await expect(page.getByRole("link", { name: /^Production$/ })).toHaveAttribute("href", "/producer");
  });

  test("unknown route renders branded not-found", async ({ page }) => {
    await page.goto("/zzz-e2e-missing-page-90210");
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });

  test("invite invalid page renders guidance", async ({ page }) => {
    await page.goto("/invite/invalid");
    await expect(page.getByRole("heading", { name: /link invalid or expired/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /go to sign in/i })).toHaveAttribute("href", "/login");
  });

  test("reset invalid page renders guidance", async ({ page }) => {
    await page.goto("/reset/invalid");
    await expect(page.getByRole("heading", { name: /link invalid or expired/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /request reset again/i })).toHaveAttribute("href", "/login/forgot-password");
  });
});
