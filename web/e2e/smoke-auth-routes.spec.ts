import { expect, test } from "@playwright/test";

/** Pragmatic “login → portal” spike: unauthenticated users must not see app chrome. */
test.describe("auth shell redirects", () => {
  test("portal sends user to login with callback", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/login/);
    expect(decodeURIComponent(page.url())).toContain("callbackUrl=");
    expect(decodeURIComponent(page.url())).toContain("/portal");
  });

  test("producer sends user to login with callback", async ({ page }) => {
    await page.goto("/producer");
    await expect(page).toHaveURL(/\/login/);
    expect(decodeURIComponent(page.url())).toContain("callbackUrl=");
    expect(decodeURIComponent(page.url())).toContain("/producer");
  });

  test("nested portal route sends user to login with full callback path", async ({ page }) => {
    await page.goto("/portal/intake/new");
    await expect(page).toHaveURL(/\/login/);
    expect(decodeURIComponent(page.url())).toContain("callbackUrl=");
    expect(decodeURIComponent(page.url())).toContain("/portal/intake/new");
  });

  test("nested producer route sends user to login with full callback path", async ({ page }) => {
    await page.goto("/producer/inbox");
    await expect(page).toHaveURL(/\/login/);
    expect(decodeURIComponent(page.url())).toContain("callbackUrl=");
    expect(decodeURIComponent(page.url())).toContain("/producer/inbox");
  });

  test("producer media library redirects unauthenticated visitor to login with callback", async ({ page }) => {
    await page.goto("/producer/media-library");
    await expect(page).toHaveURL(/\/login/);
    expect(decodeURIComponent(page.url())).toContain("callbackUrl=");
    expect(decodeURIComponent(page.url())).toContain("/producer/media-library");
  });
});
