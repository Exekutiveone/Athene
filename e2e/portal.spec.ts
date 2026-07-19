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

test("admin creates, saves and reloads a complete mission result while heatmap controls remain usable", async ({ page, request }) => {
  page.once("dialog", (dialog) => dialog.accept("athene-e2e-admin-token"));
  await page.getByLabel("Portalrolle").selectOption("admin");

  await page.getByRole("button", { name: "GeoID öffnen" }).first().click();
  await expect(page.getByRole("button", { name: "Mission speichern" })).toBeVisible();
  await page.getByRole("button", { name: "Standardroute zum Bearbeiten laden" }).click();
  await expect(page.getByText("Missionspfad aktiv")).toBeVisible();
  await page.getByRole("button", { name: "Weg speichern" }).click();
  await page.getByRole("button", { name: "Mission speichern" }).click();
  await expect(page.getByRole("button", { name: "Mission gespeichert" })).toBeVisible({ timeout: 15_000 });

  await page.getByText("Datendarstellung").locator("select").selectOption("surface");
  await expect(page.getByText("Interpolationsmodus")).toBeVisible();
  await page.getByText("Interpolationsmodus").locator("select").selectOption("confidence");
  await expect(page.getByText(/Max\. Distanz: 30 m/)).toBeVisible();
  await expect(page.getByText(/Min\. Confidence: 45 %/)).toBeVisible();

  const recordsResponse = await request.get("/api/mission-records");
  expect(recordsResponse.ok()).toBeTruthy();
  const records = await recordsResponse.json() as Array<{ missionId: string; observations?: unknown[]; detections?: unknown[]; missionPath?: { segments?: unknown[][] } }>;
  const saved = records.find((record) => record.missionId === "cust-esslingen-20260716-fire");
  expect(saved?.observations?.length).toBeGreaterThan(0);
  expect(saved?.detections).toBeDefined();
  expect(saved?.missionPath?.segments?.length).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kommunale Einsatzplattform" })).toBeVisible();
  await page.getByRole("button", { name: "GeoID öffnen" }).first().click();
  await expect(page.getByText("Missionspfad aktiv")).toBeVisible();
});

test("customer mutations are rejected by the server", async ({ request }) => {
  const missions = await (await request.get("/api/planned-missions")).json() as Array<Record<string, unknown> & { id: string }>;
  const response = await request.put(`/api/planned-missions/${missions[0].id}`, { data: { ...missions[0], title: "Customer must not write" } });
  expect(response.status()).toBe(403);
});

test("archive keeps mission results while full deletion removes planning and results", async ({ request }) => {
  const headers = { Authorization: "Bearer athene-e2e-admin-token" };
  const plans = await (await request.get("/api/planned-missions")).json() as Array<Record<string, unknown> & { id: string }>;
  const results = await (await request.get("/api/mission-records")).json() as Array<Record<string, unknown> & { id: string; missionId: string; observations?: Array<Record<string, unknown>> }>;
  const sourcePlan = plans.find((plan) => plan.id === "cust-esslingen-20260716-fire")!;
  const sourceResult = results.find((result) => result.missionId === sourcePlan.id)!;
  const id = "e2e-archive-delete";
  const plannedMission = { ...sourcePlan, id, title: "E2E Archivmission", status: "bereit", archivedAt: undefined };
  const missionRecord = { ...sourceResult, id: `mission-result-${id}`, missionId: id, observations: sourceResult.observations?.map((observation) => ({ ...observation, missionId: id })) };

  expect((await request.put(`/api/planned-missions/${id}/result`, { headers, data: { plannedMission, missionRecord } })).ok()).toBeTruthy();
  expect((await request.put(`/api/planned-missions/${id}`, { headers, data: { ...plannedMission, status: "archiviert", archivedAt: new Date().toISOString() } })).ok()).toBeTruthy();
  expect((await (await request.get("/api/mission-records")).json() as Array<{ missionId: string }>).some((result) => result.missionId === id)).toBeTruthy();

  expect((await request.delete(`/api/planned-missions/${id}?deleteResults=true`, { headers })).status()).toBe(204);
  expect((await (await request.get("/api/planned-missions")).json() as Array<{ id: string }>).some((plan) => plan.id === id)).toBeFalsy();
  expect((await (await request.get("/api/mission-records")).json() as Array<{ missionId: string }>).some((result) => result.missionId === id)).toBeFalsy();
});
