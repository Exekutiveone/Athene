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

test("full mission results survive a database restart without regeneration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "athene-store-full-mission-"));
  const path = join(directory, "database.json");
  await readDatabaseFrom(path);
  const waypoint = { id: "wp-1", sequence: 1, minute: 0, speedKmh: 3, lat: 48.1, lng: 9.1 };
  const observation = {
    id: "obs-1", missionId: "mission-persisted", waypointId: waypoint.id, timestamp: "2026-07-19T10:00:00.000Z", minute: 0,
    lat: waypoint.lat, lng: waypoint.lng,
    values: { temperature: 24, humidity: 48, pressure: 1012, co2: 420, voc: 90, pm1: 2, pm25: 4, pm10: 8, luxGround: 3000, luxCanopy: 12000, dryStress: 0.42 },
    detections: [{ type: "bird" as const, label: "Amsel", confidence: 0.82 }], dataOrigin: "synthetic" as const, dataStatus: "simulated" as const,
    confidence: 0.84, source: "Athene Mock Generator", generatorVersion: "test-generator-1",
  };
  const record = {
    id: "mission-result-mission-persisted", missionId: "mission-persisted", areaId: "area-a", municipalityId: "municipality-a", scenarioName: "Persisted",
    forestAreaName: "Forest", pathName: "Route", createdAt: "2026-07-19T10:00:00.000Z", updatedAt: "2026-07-19T10:05:00.000Z",
    missionStartedAt: "2026-07-19T10:00:00.000Z", missionCompletedAt: "2026-07-19T10:05:00.000Z", surveyedAt: "2026-07-19T10:05:00.000Z",
    seed: "stable-seed", generatorVersion: "test-generator-1", summary: "Persisted result", metrics: {}, recommendations: [], dataOrigin: "synthetic" as const,
    dataStatus: "derived" as const, confidence: 0.84, source: "Athene Mock Generator", coverageShare: 0.2, unknownShare: 0.8, linkageStatus: "linked" as const,
    observations: [observation], detections: [{ ...observation.detections[0], observationId: observation.id, lat: observation.lat, lng: observation.lng, timestamp: observation.timestamp, dataOrigin: observation.dataOrigin, dataStatus: observation.dataStatus, source: observation.source, modelVersion: observation.generatorVersion }],
    missionPath: { name: "Route", waypoints: [waypoint, { ...waypoint, id: "wp-2", sequence: 2, lat: 48.2, lng: 9.2 }], segments: [[waypoint, { ...waypoint, id: "wp-2", sequence: 2, lat: 48.2, lng: 9.2 }]] },
    scenarioParams: { forestType: "Mischwald" as const, season: "Sommer" as const, drought: 0.4, pollution: 0.2, pestPressure: 0.1, stormDamage: 0.1 }, resultVersion: 1 as const,
  };
  await updateDatabaseAt(path, (database) => { database.missionRecords = [record]; });
  const restarted = await readDatabaseFrom(path);
  assert.deepEqual(restarted.missionRecords[0].observations, [observation]);
  assert.deepEqual(restarted.missionRecords[0].detections, record.detections);
  assert.deepEqual(restarted.missionRecords[0].scenarioParams, record.scenarioParams);
  assert.equal(restarted.missionRecords[0].missionPath?.segments?.length, 1);
  assert.equal(restarted.missionRecords[0].seed, "stable-seed");
});
