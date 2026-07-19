import assert from "node:assert/strict";
import test from "node:test";
import { MissionRecord } from "../src/domain.js";
import { generateMission, generateObservations, generateScenario } from "../src/generator.js";
import {
  aggregateAreaRecords,
  calculatePolygonHectares,
  calculateRouteCoverageShare,
  hasDefinedMissionPath,
  missionPathWaypoints,
  normalizeDeploymentArea,
  resolveManagementSelection,
  seedDeploymentAreas,
  seedMunicipalities,
  seedPlannedMissions,
  stableMissionId,
} from "../src/management.js";

test("polygon hectare calculation produces a plausible positive area", () => {
  const oneHectareSquare = [
    { lat: 48, lng: 9 },
    { lat: 48 + 100 / 111_320, lng: 9 },
    { lat: 48 + 100 / 111_320, lng: 9 + 100 / (111_320 * Math.cos((48 * Math.PI) / 180)) },
    { lat: 48, lng: 9 + 100 / (111_320 * Math.cos((48 * Math.PI) / 180)) },
  ];
  assert.ok(Math.abs(calculatePolygonHectares(oneHectareSquare) - 1) < 0.03);
});

test("stable mission IDs are repeatable and distinct across areas", () => {
  const first = stableMissionId("area-a", "seed-13", "2026-07-17T10:00:00.000Z");
  assert.equal(first, stableMissionId("area-a", "seed-13", "2026-07-17T10:00:00.000Z"));
  assert.notEqual(first, stableMissionId("area-b", "seed-13", "2026-07-17T10:00:00.000Z"));
});

test("generator missions keep their area linkage and do not collapse to ES-001", () => {
  const scenario = generateScenario("same-seed");
  const first = generateMission(scenario, { areaId: "testwald-a", municipalityId: "mun-a" });
  const second = generateMission(scenario, { areaId: "testwald-b", municipalityId: "mun-b" });
  assert.equal(first.areaId, "testwald-a");
  assert.equal(first.municipalityId, "mun-a");
  assert.notEqual(first.id, second.id);
});

test("area aggregation only links records with the same areaId", () => {
  const records = [record("one", "area-a", 0.4, 0.8), record("two", "area-a", 0.6, 0.7), record("other", "area-b", 0.99, 0.1)];
  const aggregate = aggregateAreaRecords("area-a", records);
  assert.equal(aggregate.missionCount, 2);
  assert.equal(aggregate.dryStress, 0.5);
  assert.equal(aggregate.confidence, 0.75);
});

test("area aggregation keeps only the newest record version per mission and exposes mixed provenance", () => {
  const older = record("older", "area-a", 0.2, 0.6, { missionId: "mission-versioned", createdAt: "2026-07-10T10:00:00.000Z", coverageShare: 0.2 });
  const newer = record("newer", "area-a", 0.8, 0.9, { missionId: "mission-versioned", createdAt: "2026-07-12T10:00:00.000Z", coverageShare: 0.6, surveyedAt: "2026-07-11T12:00:00.000Z" });
  const measured = record("measured", "area-a", 0.4, 0.7, { missionId: "mission-measured", dataOrigin: "real", dataStatus: "measured", coverageShare: 0.8, surveyedAt: "2026-07-13T12:00:00.000Z" });
  const aggregate = aggregateAreaRecords("area-a", [older, newer, measured]);
  assert.equal(aggregate.missionCount, 2);
  assert.equal(aggregate.dryStress, 0.6);
  assert.equal(aggregate.coverageShare, 0.7);
  assert.equal(aggregate.unknownShare, 0.3);
  assert.equal(aggregate.dataOrigin, "mixed");
  assert.equal(aggregate.dataStatus, "mixed");
  assert.equal(aggregate.lastSurvey, "2026-07-13T12:00:00.000Z");
});

test("route coverage is bounded and invalid area sizes remain unknown", () => {
  assert.equal(calculateRouteCoverageShare(1_000, 10, 2), 0.5);
  assert.equal(calculateRouteCoverageShare(100_000, 20, 2), 1);
  assert.equal(calculateRouteCoverageShare(1_000, 10, 0), null);
});

test("atomic selection derives municipality and area from the requested mission", () => {
  const selected = resolveManagementSelection(
    { municipalities: seedMunicipalities, areas: seedDeploymentAreas, missions: seedPlannedMissions },
    { municipalityId: "mun-esslingen", missionId: "cust-remstal-20260716-storm" },
  );
  assert.deepEqual(selected, {
    municipalityId: "mun-remstal",
    areaId: "area-rem-storm",
    missionId: "cust-remstal-20260716-storm",
  });
});

test("switching a municipality never retains children from the previous scope", () => {
  const selected = resolveManagementSelection(
    { municipalities: seedMunicipalities, areas: seedDeploymentAreas, missions: seedPlannedMissions },
    { municipalityId: "mun-neckartal" },
  );
  assert.equal(selected.municipalityId, "mun-neckartal");
  assert.ok(seedDeploymentAreas.some((area) => area.id === selected.areaId && area.municipalityId === "mun-neckartal"));
  if (selected.missionId) assert.ok(seedPlannedMissions.some((mission) => mission.id === selected.missionId && mission.municipalityId === "mun-neckartal" && mission.areaId === selected.areaId));
});

test("a newly created area survives normalization and is immediately selectable", () => {
  const area = normalizeDeploymentArea({
    id: "area-created",
    name: "Testfläche",
    municipalityId: "mun-esslingen",
    scopeId: "gemeinde-081160019",
    scopeName: "Esslingen am Neckar",
    polygon: [{ lat: 48.74, lng: 9.26 }, { lat: 48.75, lng: 9.26 }, { lat: 48.75, lng: 9.27 }],
  });
  const selected = resolveManagementSelection(
    { municipalities: seedMunicipalities, areas: [area, ...seedDeploymentAreas], missions: seedPlannedMissions },
    { areaId: area.id, missionId: null },
  );
  assert.deepEqual(selected, { municipalityId: "mun-esslingen", areaId: "area-created", missionId: null });
});

test("legacy and pending area boundaries normalize without changing the area identity", () => {
  const legacy = normalizeDeploymentArea({ id: "legacy", name: "Legacy", polygon: [{ lat: 48, lng: 9 }, { lat: 48.01, lng: 9 }, { lat: 48.01, lng: 9.01 }] });
  assert.equal(legacy.boundaryStatus, "defined");
  const pending = normalizeDeploymentArea({ ...legacy, id: "pending", boundaryStatus: "pending" });
  const drawn = normalizeDeploymentArea({ ...pending, boundaryStatus: "defined", polygon: [{ lat: 48.1, lng: 9.1 }, { lat: 48.11, lng: 9.1 }, { lat: 48.11, lng: 9.11 }] });
  assert.equal(drawn.id, pending.id);
  assert.equal(drawn.boundaryStatus, "defined");
});

test("missions require a usable explicitly assigned path", () => {
  assert.equal(hasDefinedMissionPath({}), false);
  assert.equal(hasDefinedMissionPath({ missionPath: null }), false);
  assert.equal(hasDefinedMissionPath({ missionPath: { name: "Zu kurz", waypoints: [] } }), false);
  assert.equal(hasDefinedMissionPath({ missionPath: { name: "Route", waypoints: [{ id: "a", sequence: 1, minute: 0, speedKmh: 2, lat: 48, lng: 9 }, { id: "b", sequence: 2, minute: 1, speedKmh: 2, lat: 48.01, lng: 9.01 }] } }), true);
});

test("mission route loading never falls back to another or generated path", () => {
  const routeA = [{ id: "a-1", sequence: 1, minute: 0, speedKmh: 2, lat: 48.1, lng: 9.1 }, { id: "a-2", sequence: 2, minute: 1, speedKmh: 2, lat: 48.2, lng: 9.2 }];
  const routeB = [{ id: "b-1", sequence: 1, minute: 0, speedKmh: 2, lat: 49.1, lng: 10.1 }, { id: "b-2", sequence: 2, minute: 1, speedKmh: 2, lat: 49.2, lng: 10.2 }];
  assert.deepEqual(missionPathWaypoints({ missionPath: null }), []);
  assert.deepEqual(missionPathWaypoints({ missionPath: { name: "Route A", waypoints: routeA } }), routeA);
  assert.deepEqual(missionPathWaypoints({ missionPath: { name: "Route B", waypoints: routeB } }), routeB);
});

test("sensor observations can be generated for manual and detected forest routes", () => {
  const scenario = generateScenario("route-source-test");
  const manualRoute = { ...scenario.forestPath, waypoints: scenario.forestPath.waypoints.slice(0, 3) };
  const detectedRoute = { ...scenario.forestPath, name: "OSM Waldweg", waypoints: scenario.forestPath.waypoints.slice(3, 7) };
  const manualScenario = { ...scenario, forestPath: manualRoute };
  const detectedScenario = { ...scenario, forestPath: detectedRoute };
  assert.equal(generateObservations(generateMission(manualScenario), manualScenario).length, manualRoute.waypoints.length);
  assert.equal(generateObservations(generateMission(detectedScenario), detectedScenario).length, detectedRoute.waypoints.length);
});

test("unknown legacy scopes remain unassigned instead of leaking into Esslingen", () => {
  const area = normalizeDeploymentArea({
    id: "legacy-unknown",
    name: "Unbekannte Fläche",
    scopeId: "legacy-custom-scope",
    scopeName: "Unbekannter Ort",
    polygon: [{ lat: 48, lng: 9 }, { lat: 48.01, lng: 9 }, { lat: 48.01, lng: 9.01 }],
  });
  assert.equal(area.municipalityId, null);
  assert.equal(area.linkageStatus, "review-needed");
});

test("no-data aggregation remains null instead of reporting a healthy zero", () => {
  const aggregate = aggregateAreaRecords("unobserved-area", []);
  assert.equal(aggregate.missionCount, 0);
  assert.equal(aggregate.dryStress, null);
  assert.equal(aggregate.confidence, null);
  assert.equal(aggregate.lastSurvey, null);
});

function record(id: string, areaId: string, dryStress: number, confidence: number, patch: Partial<MissionRecord> = {}): MissionRecord {
  return {
    id,
    missionId: `mission-${id}`,
    areaId,
    municipalityId: areaId === "area-a" ? "mun-a" : "mun-b",
    scenarioName: id,
    forestAreaName: areaId,
    pathName: "Route",
    createdAt: `2026-07-${id === "one" ? "10" : "11"}T10:00:00.000Z`,
    missionStartedAt: null,
    missionCompletedAt: null,
    surveyedAt: null,
    seed: id,
    generatorVersion: "test",
    summary: "synthetic test record",
    metrics: { averageDryStress: dryStress, averageConfidence: confidence },
    recommendations: [],
    dataOrigin: "synthetic",
    dataStatus: "derived",
    confidence,
    source: "test",
    coverageShare: 0.5,
    unknownShare: 0.5,
    linkageStatus: "linked",
    ...patch,
  };
}
