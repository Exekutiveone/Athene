import { DeploymentArea, MissionRecord, MunicipalityRecord, PlannedMissionRecord, SavedPathRecord, SavedScenarioRecord, StakeholderRecord } from "../src/domain.js";
import { normalizeDeploymentArea } from "../src/management.js";
import { createMissionPath, flattenRouteSegments } from "../src/routeGeometry.js";

const areaStatuses = ["aktiv", "planung", "review", "archiviert"] as const;
const recordStatuses = ["measured", "simulated", "derived", "interpolated", "modeled", "unknown"] as const;
const origins = ["synthetic", "real", "external"] as const;
const municipalityTypes = ["Gemeinde", "Stadt", "Landkreis"] as const;
const accessValues = ["Admin", "Operator", "Viewer"] as const;
const entityStatuses = ["active", "archived"] as const;
const missionPriorities = ["normal", "hoch", "kritisch"] as const;
const missionStatuses = ["entwurf", "geplant", "bereit", "processing", "abgeschlossen", "archiviert"] as const;

export function ensurePathRecord(value: unknown): SavedPathRecord {
  const record = value as SavedPathRecord;
  if (!record?.id || !record.name || !record.savedAt || !Array.isArray(record.waypoints)) invalid("path record");
  return record;
}

export function ensureScenarioRecord(value: unknown): SavedScenarioRecord {
  const record = value as SavedScenarioRecord;
  if (!record?.id || !record.name || !record.savedAt || !record.seed || !record.params || !Array.isArray(record.waypoints)) invalid("scenario record");
  if (!["Mischwald", "Nadelwald", "Laubwald", "Aufforstungsfläche"].includes(record.params.forestType)) invalid("forest type");
  if (!["Frühjahr", "Sommer", "Herbst", "Winter"].includes(record.params.season)) invalid("season");
  return record;
}

export function ensureMissionRecord(value: unknown): MissionRecord {
  const record = value as MissionRecord;
  if (!record?.id || !record.missionId || !record.scenarioName || !record.createdAt || !record.summary || !Array.isArray(record.recommendations)) invalid("mission record");
  if (!origins.includes(record.dataOrigin as never)) invalid("mission dataOrigin");
  if (!recordStatuses.includes(record.dataStatus as never)) invalid("mission dataStatus");
  if (!isNullableUnit(record.confidence) || !isNullableUnit(record.coverageShare) || !isNullableUnit(record.unknownShare)) invalid("mission confidence/coverage");
  if (record.coverageShare !== null && record.unknownShare !== null && Math.abs(record.coverageShare + record.unknownShare - 1) > 0.02) invalid("coverage sum");
  if (record.linkageStatus === "linked" && (!record.areaId || !record.municipalityId)) invalid("linked mission IDs");
  if (!["linked", "review-needed"].includes(record.linkageStatus)) invalid("mission linkageStatus");
  if (record.observations !== undefined) {
    if (!Array.isArray(record.observations) || !record.observations.every((observation) =>
      observation.missionId === record.missionId && Number.isFinite(observation.lat) && Number.isFinite(observation.lng) &&
      Boolean(observation.timestamp && observation.source && observation.generatorVersion) && origins.includes(observation.dataOrigin as never) &&
      recordStatuses.includes(observation.dataStatus as never) && Number.isFinite(observation.confidence) && observation.confidence >= 0 && observation.confidence <= 1 &&
      Array.isArray(observation.detections))) invalid("mission observations");
  }
  if (record.detections !== undefined && (!Array.isArray(record.detections) || !record.detections.every((detection) =>
    detection.observationId && detection.timestamp && detection.source && Number.isFinite(detection.lat) && Number.isFinite(detection.lng) &&
    Number.isFinite(detection.confidence) && detection.confidence >= 0 && detection.confidence <= 1))) invalid("mission detections");
  if (record.missionPath !== undefined && record.missionPath !== null) {
    if (!record.missionPath.name || !Array.isArray(record.missionPath.waypoints)) invalid("mission result path");
    const canonicalWaypoints = record.missionPath.segments?.length ? flattenRouteSegments(record.missionPath.segments) : record.missionPath.waypoints;
    if (!canonicalWaypoints.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))) invalid("mission result path coordinates");
    record.missionPath = createMissionPath(record.missionPath.name, canonicalWaypoints);
  }
  if (record.scenarioParams !== undefined) {
    if (!record.scenarioParams || !["Mischwald", "Nadelwald", "Laubwald", "Aufforstungsfläche"].includes(record.scenarioParams.forestType) || !["Frühjahr", "Sommer", "Herbst", "Winter"].includes(record.scenarioParams.season)) invalid("mission scenario parameters");
    if (![record.scenarioParams.drought, record.scenarioParams.pollution, record.scenarioParams.pestPressure, record.scenarioParams.stormDamage].every((number) => Number.isFinite(number) && number >= 0 && number <= 1)) invalid("mission scenario parameter values");
  }
  return record;
}

export function ensureDeploymentArea(value: unknown): DeploymentArea {
  const area = normalizeDeploymentArea(value as DeploymentArea);
  if (!area?.id || !area.name || !area.scopeId || !area.scopeName || !area.createdAt || !Array.isArray(area.polygon) || area.polygon.length < 3) invalid("deployment area");
  if (!areaStatuses.includes(area.status as never)) invalid("area status");
  if (!["pending", "defined"].includes(area.boundaryStatus)) invalid("area boundaryStatus");
  if (!origins.includes(area.dataOrigin as never) || !recordStatuses.includes(area.dataStatus as never)) invalid("area provenance");
  if (!area.polygon.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))) invalid("area polygon");
  if (area.linkageStatus === "linked" && !area.municipalityId) invalid("linked area municipalityId");
  return area;
}

export function ensureMunicipality(value: unknown): MunicipalityRecord {
  const record = value as MunicipalityRecord;
  if (!record?.id || !record.name || !record.region || !record.center || !record.createdAt) invalid("municipality");
  if (!municipalityTypes.includes(record.type as never) || !entityStatuses.includes(record.status as never)) invalid("municipality enum");
  if (!Number.isFinite(record.population) || !Number.isFinite(record.center.lat) || !Number.isFinite(record.center.lng)) invalid("municipality numbers");
  return record;
}

export function ensureStakeholder(value: unknown): StakeholderRecord {
  const record = value as StakeholderRecord;
  if (!record?.id || !record.municipalityId || !record.name || !record.role || !record.createdAt) invalid("stakeholder");
  if (!accessValues.includes(record.access as never) || !entityStatuses.includes(record.status as never)) invalid("stakeholder enum");
  return record;
}

export function ensurePlannedMission(value: unknown): PlannedMissionRecord {
  const record = value as PlannedMissionRecord;
  if (!record?.id || !record.municipalityId || !record.areaId || !record.title || !record.params || !record.createdAt) invalid("planned mission");
  if (!missionPriorities.includes(record.priority as never) || !missionStatuses.includes(record.status as never)) invalid("planned mission enum");
  if (record.missionPath !== undefined && record.missionPath !== null) {
    if (!record.missionPath.name || !Array.isArray(record.missionPath.waypoints)) invalid("planned mission path");
    const suppliedSegments = record.missionPath.segments;
    if (suppliedSegments !== undefined && (!Array.isArray(suppliedSegments) || suppliedSegments.some((segment) => !Array.isArray(segment) || segment.length < 2))) invalid("planned mission path segments");
    const canonicalWaypoints = suppliedSegments?.length ? flattenRouteSegments(suppliedSegments) : record.missionPath.waypoints;
    if (!canonicalWaypoints.every((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))) invalid("planned mission path coordinates");
    record.missionPath = createMissionPath(record.missionPath.name, canonicalWaypoints);
  }
  if (record.routeSummary !== undefined) {
    const summary = record.routeSummary;
    if (!isNullableUnit(summary.averageDryStress) || !isNullableUnit(summary.averageConfidence) || !Number.isInteger(summary.observationCount) || summary.observationCount < 1) invalid("planned mission route summary");
    if (!summary.calculatedAt || !summary.source || !["real", "synthetic"].includes(summary.dataOrigin) || !["measured", "derived"].includes(summary.dataStatus)) invalid("planned mission route summary metadata");
  }
  return record;
}

function isNullableUnit(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= 1);
}

function invalid(name: string): never {
  throw new Error(`Invalid ${name}`);
}
