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

  test("portal project route redirects with full callback path", async ({ page }) => {
    const path = "/portal/projects/00000000-0000-4000-8000-000000000001";
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    const decoded = decodeURIComponent(page.url());
    expect(decoded).toContain("callbackUrl=");
    expect(decoded).toContain(path);
  });

  test("portal shows route redirects with full callback path", async ({ page }) => {
    const path = "/portal/shows/00000000-0000-4000-8000-000000000002";
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    const decoded = decodeURIComponent(page.url());
    expect(decoded).toContain("callbackUrl=");
    expect(decoded).toContain(path);
  });

  test("producer intake detail redirects with full callback path", async ({ page }) => {
    const path = "/producer/inbox/aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    const decoded = decodeURIComponent(page.url());
    expect(decoded).toContain("callbackUrl=");
    expect(decoded).toContain(path);
  });

  test("producer event workspace redirects with full callback path", async ({ page }) => {
    const path = "/producer/inbox/aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee/event";
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    const decoded = decodeURIComponent(page.url());
    expect(decoded).toContain("callbackUrl=");
    expect(decoded).toContain(path);
  });

  test("producer support queue redirects with full callback path", async ({ page }) => {
    await page.goto("/producer/support");
    await expect(page).toHaveURL(/\/login/);
    const decoded = decodeURIComponent(page.url());
    expect(decoded).toContain("callbackUrl=");
    expect(decoded).toContain("/producer/support");
  });

  test("producer support ticket redirects with full callback path", async ({ page }) => {
    const path = "/producer/support/clh5m0mt0000e2e2smoke99901";
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    const decoded = decodeURIComponent(page.url());
    expect(decoded).toContain("callbackUrl=");
    expect(decoded).toContain(path);
  });

  test("producer admin users redirects with full callback path", async ({ page }) => {
    await page.goto("/producer/admin/users");
    await expect(page).toHaveURL(/\/login/);
    const decoded = decodeURIComponent(page.url());
    expect(decoded).toContain("callbackUrl=");
    expect(decoded).toContain("/producer/admin/users");
  });

  test("portal project support redirects with full callback path", async ({ page }) => {
    const path = "/portal/projects/00000000-0000-4000-8000-000000000003/support";
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
    const decoded = decodeURIComponent(page.url());
    expect(decoded).toContain("callbackUrl=");
    expect(decoded).toContain(path);
  });
});
