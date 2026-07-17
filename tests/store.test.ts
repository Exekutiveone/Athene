import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeDatabase, readDatabaseFrom, updateDatabaseAt } from "../server/store.js";

test("a corrupt database is reported and never overwritten with demo data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "athene-store-corrupt-"));
  const path = join(directory, "database.json");
  await writeFile(path, "{not-json", "utf8");
  await assert.rejects(readDatabaseFrom(path), SyntaxError);
  assert.equal(await readFile(path, "utf8"), "{not-json");
});

test("intentionally empty valid tables stay empty during migration", () => {
  const database = normalizeDatabase({
    savedPaths: [], savedScenarios: [], missionRecords: [], deploymentAreas: [], municipalities: [], stakeholders: [], plannedMissions: [],
  });
  assert.deepEqual(database.deploymentAreas, []);
  assert.deepEqual(database.municipalities, []);
  assert.deepEqual(database.stakeholders, []);
  assert.deepEqual(database.plannedMissions, []);
});

test("unknown legacy areas and mission records migrate to explicit review-needed state", () => {
  const database = normalizeDatabase({
    deploymentAreas: [{
      id: "legacy-area", name: "Custom forest", scopeId: "custom-scope", scopeName: "Custom place",
      polygon: [{ lat: 48, lng: 9 }, { lat: 48.01, lng: 9 }, { lat: 48.01, lng: 9.01 }], createdAt: "2026-01-01T00:00:00.000Z",
    }],
    municipalities: [], stakeholders: [], plannedMissions: [],
    missionRecords: [{
      id: "record-legacy", missionId: "mission-legacy", scenarioName: "Legacy", forestAreaName: "Not this area", pathName: "Route",
      createdAt: "2026-01-02T00:00:00.000Z", seed: "seed", generatorVersion: "legacy", summary: "legacy record", metrics: {}, recommendations: [],
    }],
  });
  assert.equal(database.deploymentAreas[0].municipalityId, null);
  assert.equal(database.deploymentAreas[0].linkageStatus, "review-needed");
  assert.equal(database.missionRecords[0].areaId, null);
  assert.equal(database.missionRecords[0].municipalityId, null);
  assert.equal(database.missionRecords[0].linkageStatus, "review-needed");
});

test("updates to the same database path are serialized without lost writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "athene-store-queue-"));
  const path = join(directory, "database.json");
  await readDatabaseFrom(path);
  await Promise.all([
    updateDatabaseAt(path, async (database) => {
      await Promise.resolve();
      database.savedPaths.push({ id: "one", name: "One", savedAt: "2026-01-01T00:00:00.000Z", waypoints: [] });
    }),
    updateDatabaseAt(path, (database) => {
      database.savedPaths.push({ id: "two", name: "Two", savedAt: "2026-01-01T00:00:00.000Z", waypoints: [] });
    }),
  ]);
  const database = await readDatabaseFrom(path);
  assert.deepEqual(database.savedPaths.map((item) => item.id).sort(), ["one", "two"]);
});
