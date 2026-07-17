import assert from "node:assert/strict";
import test from "node:test";
import { MissionRecord } from "../src/domain.js";
import { seedDeploymentAreas, seedMunicipalities, seedPlannedMissions, seedStakeholders } from "../src/management.js";
import { ensureDeploymentArea, ensureMissionRecord, ensureMunicipality, ensurePlannedMission, ensureStakeholder } from "../server/validation.js";

test("valid management records pass server boundary validation", () => {
  assert.equal(ensureMunicipality(seedMunicipalities[0]).id, seedMunicipalities[0].id);
  assert.equal(ensureStakeholder(seedStakeholders[0]).id, seedStakeholders[0].id);
  assert.equal(ensureDeploymentArea(seedDeploymentAreas[0]).id, seedDeploymentAreas[0].id);
  assert.equal(ensurePlannedMission(seedPlannedMissions[0]).id, seedPlannedMissions[0].id);
  assert.equal(ensureMissionRecord(missionRecord()).id, "record-valid");
});

test("invalid enums are rejected instead of silently persisted", () => {
  assert.throws(() => ensureMunicipality({ ...seedMunicipalities[0], type: "Bundesland" }), /Invalid municipality enum/);
  assert.throws(() => ensureStakeholder({ ...seedStakeholders[0], access: "Root" }), /Invalid stakeholder enum/);
  assert.throws(() => ensureDeploymentArea({ ...seedDeploymentAreas[0], status: "done" }), /Invalid area status/);
  assert.throws(() => ensurePlannedMission({ ...seedPlannedMissions[0], priority: "sofort" }), /Invalid planned mission enum/);
});

test("mission linkage and coverage invariants are enforced", () => {
  assert.throws(() => ensureMissionRecord({ ...missionRecord(), municipalityId: null }), /Invalid linked mission IDs/);
  assert.throws(() => ensureMissionRecord({ ...missionRecord(), coverageShare: 0.8, unknownShare: 0.8 }), /Invalid coverage sum/);
  assert.throws(() => ensureMissionRecord({ ...missionRecord(), confidence: 2 }), /Invalid mission confidence\/coverage/);
});

function missionRecord(): MissionRecord {
  return {
    id: "record-valid",
    missionId: "mission-valid",
    areaId: "area-ess-south",
    municipalityId: "mun-esslingen",
    scenarioName: "Valid mission",
    forestAreaName: "Südhang ES-001",
    pathName: "Route",
    createdAt: "2026-07-17T10:00:00.000Z",
    missionStartedAt: "2026-07-17T09:00:00.000Z",
    missionCompletedAt: "2026-07-17T10:00:00.000Z",
    surveyedAt: "2026-07-17T10:00:00.000Z",
    seed: "seed",
    generatorVersion: "test-1",
    summary: "Valid",
    metrics: { averageConfidence: 0.8 },
    recommendations: [],
    dataOrigin: "synthetic",
    dataStatus: "simulated",
    confidence: 0.8,
    source: "test",
    coverageShare: 0.6,
    unknownShare: 0.4,
    linkageStatus: "linked",
  };
}
