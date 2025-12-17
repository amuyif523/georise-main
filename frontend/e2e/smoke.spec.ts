import { test, expect, type Page } from "@playwright/test";

const login = async (page: Page, email: string, password: string) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForURL(/redirect-after-login|\/citizen|\/admin|\/agency/, { timeout: 15000 });
};

test("Admin can log in and load analytics", async ({ page }) => {
  await login(page, "admin@example.com", "password123");
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "Advanced Analytics" })).toBeVisible();
});

test("Agency staff can load agency map", async ({ page }) => {
  await login(page, "police1@example.com", "password123");
  await page.goto("/agency/map");
  await expect(page.locator(".leaflet-container").first()).toBeVisible();
  await expect(page.getByText("Live queue")).toBeVisible();
});

test("Citizen can submit an incident report", async ({ page }) => {
  await login(page, "citizen1@example.com", "password123");
  await page.goto("/citizen/report");

  const inputs = await page.getByRole("textbox").all();
  const [titleInput, descriptionInput] = inputs;
  await titleInput.fill("Smoke near Bole");
  await descriptionInput.fill("Visible smoke rising from an apartment building.");

  await page.getByRole("button", { name: "Continue to location" }).click();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.locator(".leaflet-container").first().click({ position: { x: 150, y: 150 } });
  await expect(page.getByText("Selected location:")).toBeVisible();

  await page.getByRole("button", { name: "Review & submit" }).click();
  await page.getByRole("button", { name: "Submit incident" }).click();

  await page.waitForURL("**/citizen/my-reports", { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "My Reports" })).toBeVisible();
});
