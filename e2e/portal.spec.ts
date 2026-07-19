import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kommunale Einsatzplattform" })).toBeVisible();
});

test("customer remains read-only and cannot access management actions", async ({ page }) => {
  await page.getByLabel("Portalrolle").selectOption("customer");
  await expect(page.getByRole("button", { name: "Gemeinde anlegen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Index Builder" })).toHaveCount(0);
});

test("admin role requires and verifies the server access token", async ({ page }) => {
  page.once("dialog", (dialog) => dialog.accept("athene-e2e-admin-token"));
  await page.getByLabel("Portalrolle").selectOption("admin");
  await expect(page.getByLabel("Portalrolle")).toHaveValue("admin");
  await expect(page.getByRole("button", { name: "Gemeinde anlegen" })).toBeVisible();
});

test("municipality and forest navigation exposes explicit back navigation", async ({ page }) => {
  const mapLink = page.getByRole("button", { name: /in der Kartenansicht öffnen/ }).first();
  await mapLink.click();
  await expect(page.getByRole("button", { name: /Zurück|Portal|Zum Kreis|Zur Gemeinde/ }).first()).toBeVisible();
});
