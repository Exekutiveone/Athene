import {
  Coordinate,
  DeploymentArea,
  MissionRecord,
  MunicipalityRecord,
  PlannedMissionRecord,
  ScenarioParams,
  StakeholderRecord,
} from "./domain.js";

const now = "2026-07-16T08:00:00.000Z";

export const seedMunicipalities: MunicipalityRecord[] = [
  municipality("mun-esslingen", "Esslingen am Neckar", "Stadt", "Landkreis Esslingen", 95600, 48.7468, 9.2702, "gemeinde-081160019"),
  municipality("mun-remstal", "Remstal", "Landkreis", "Mittlerer Neckarraum", 219000, 48.8042, 9.4204, "kreis-45"),
  municipality("mun-neckartal", "Neckartal", "Gemeinde", "Neckartal Süd", 18400, 48.7225, 9.2148, "gemeinde-neckartal"),
];

export const seedStakeholders: StakeholderRecord[] = [
  stakeholder("st-ess-forst", "mun-esslingen", "Forstverwaltung Esslingen", "Kommunale Forstleitung", "Admin"),
  stakeholder("st-ess-feuer", "mun-esslingen", "Feuerwehr Esslingen", "Lage und Einsatz", "Viewer"),
  stakeholder("st-ess-umwelt", "mun-esslingen", "Amt für Umwelt", "Fachfreigabe", "Operator"),
  stakeholder("st-rem-crisis", "mun-remstal", "Kommunaler Krisenstab Remstal", "Schadenslage", "Admin"),
  stakeholder("st-rem-works", "mun-remstal", "Bauhof Verbund", "Wege und Räumung", "Operator"),
  stakeholder("st-rem-forest", "mun-remstal", "Revierdienst Remstal", "Waldzustand", "Operator"),
  stakeholder("st-neck-project", "mun-neckartal", "Aufforstungsprojekt Neckartal", "Projektsteuerung", "Admin"),
  stakeholder("st-neck-citizen", "mun-neckartal", "Bürgerdialog Wald", "Öffentliche Vorschau", "Viewer"),
  stakeholder("st-neck-nature", "mun-neckartal", "Naturschutzbeirat", "Fachliche Prüfung", "Operator"),
];

export const seedDeploymentAreas: DeploymentArea[] = [
  area("area-ess-south", "mun-esslingen", "Südhang ES-001", "gemeinde-081160019", "Esslingen am Neckar", "Trockenstress und Brandlast", "aktiv", [
    { lat: 48.7511, lng: 9.264 }, { lat: 48.7529, lng: 9.2737 }, { lat: 48.7488, lng: 9.2793 },
    { lat: 48.7434, lng: 9.2768 }, { lat: 48.7422, lng: 9.2671 }, { lat: 48.7466, lng: 9.2625 },
  ]),
  area("area-ess-public", "mun-esslingen", "Bürgerwald Nord", "gemeinde-081160019", "Esslingen am Neckar", "Bürgerinformation", "planung", rectangle(48.759, 9.278, 48.766, 9.292)),
  area("area-rem-storm", "mun-remstal", "Sturmprüfung Hauptweg", "kreis-45", "Rems-Murr-Kreis", "Kronenbruch und Befahrbarkeit", "aktiv", rectangle(48.798, 9.407, 48.81, 9.429)),
  area("area-rem-slope", "mun-remstal", "Hangwald West", "kreis-45", "Rems-Murr-Kreis", "Nachkontrolle", "review", rectangle(48.79, 9.389, 48.799, 9.405)),
  area("area-neck-young", "mun-neckartal", "Jungbestand Baseline", "gemeinde-neckartal", "Neckartal", "Anwuchs, Licht und Feuchte", "aktiv", rectangle(48.718, 9.207, 48.727, 9.22)),
  area("area-neck-buffer", "mun-neckartal", "Pufferfläche Bachlauf", "gemeinde-neckartal", "Neckartal", "Monitoring später", "planung", rectangle(48.728, 9.219, 48.733, 9.229)),
];

const fireParams: ScenarioParams = { forestType: "Mischwald", season: "Sommer", drought: 0.74, pollution: 0.31, pestPressure: 0.22, stormDamage: 0.16 };
const stormParams: ScenarioParams = { forestType: "Nadelwald", season: "Sommer", drought: 0.48, pollution: 0.24, pestPressure: 0.36, stormDamage: 0.78 };
const baselineParams: ScenarioParams = { forestType: "Aufforstungsfläche", season: "Sommer", drought: 0.42, pollution: 0.18, pestPressure: 0.12, stormDamage: 0.08 };

export const seedPlannedMissions: PlannedMissionRecord[] = [
  plannedMission("cust-esslingen-20260716-fire", "mun-esslingen", "area-ess-south", "Trockenstress-Screening Südhang", "Trockenheit, Kronenlicht, Messlücken und mögliche Brandlast-Hotspots prüfen.", "hoch", "CUSTOMER-ES-FIRE-20260716", fireParams),
  plannedMission("cust-remstal-20260716-storm", "mun-remstal", "area-rem-storm", "Sturmschaden-Nachkontrolle", "Kronenbruch, befahrbare Wege und strukturelle Auffälligkeiten nach Unwetter erfassen.", "kritisch", "CUSTOMER-REM-STORM-20260716", stormParams),
  plannedMission("cust-replanting-20260716-baseline", "mun-neckartal", "area-neck-young", "Baseline Jungbestand", "Feuchte, Lichtverteilung, Anwuchsrisiko und öffentliche Kurzinfo vorbereiten.", "normal", "CUSTOMER-NEC-BASELINE-20260716", baselineParams),
];

export function calculatePolygonHectares(polygon: Coordinate[]): number {
  if (polygon.length < 3) return 0;
  const origin = polygon[0];
  const metersPerLat = 111_320;
  const metersPerLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const points = polygon.map((point) => ({ x: (point.lng - origin.lng) * metersPerLng, y: (point.lat - origin.lat) * metersPerLat }));
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    twiceArea += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.round((Math.abs(twiceArea) / 2 / 10_000) * 100) / 100;
}

export function calculateRouteCoverageShare(routeLengthMeters: number, corridorWidthMeters: number, areaHectares: number): number | null {
  if (![routeLengthMeters, corridorWidthMeters, areaHectares].every(Number.isFinite) || routeLengthMeters < 0 || corridorWidthMeters <= 0 || areaHectares <= 0) return null;
  return Math.round(Math.min(1, (routeLengthMeters * corridorWidthMeters) / (areaHectares * 10_000)) * 1_000) / 1_000;
}

export function stableMissionId(areaId: string, seed: string, startsAt: string): string {
  const input = `${areaId}|${seed}|${startsAt}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `mission-${slug(areaId)}-${(hash >>> 0).toString(36)}`;
}

export interface AreaAggregate {
  areaId: string;
  missionCount: number;
  lastSurvey: string | null;
  dryStress: number | null;
  confidence: number | null;
  dataOrigin: "synthetic" | "real" | "external" | "mixed" | null;
  dataStatus: string | null;
  coverageShare: number | null;
  unknownShare: number | null;
}

export function aggregateAreaRecords(areaId: string, records: MissionRecord[]): AreaAggregate {
  const newestByMission = new Map<string, MissionRecord>();
  records.filter((record) => record.areaId === areaId).forEach((record) => {
    const previous = newestByMission.get(record.missionId);
    if (!previous || Date.parse(record.createdAt) >= Date.parse(previous.createdAt)) newestByMission.set(record.missionId, record);
  });
  const linked = [...newestByMission.values()];
  const dryValues = linked.map((record) => numberMetric(record, "averageDryStress")).filter((value): value is number => value !== null);
  const confidenceValues = linked.map((record) => numberMetric(record, "averageConfidence")).filter((value): value is number => value !== null);
  const coverageValues = linked.map((record) => record.coverageShare).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const dated = linked.map(recordSurveyedAt).filter((value): value is string => Boolean(value)).sort();
  const origins = new Set(linked.map((record) => record.dataOrigin));
  const statuses = new Set(linked.map((record) => record.dataStatus));
  const coverageShare = coverageValues.length ? average(coverageValues) : null;
  return {
    areaId,
    missionCount: linked.length,
    lastSurvey: dated.at(-1) ?? null,
    dryStress: dryValues.length ? average(dryValues) : null,
    confidence: confidenceValues.length ? average(confidenceValues) : null,
    dataOrigin: origins.size === 0 ? null : origins.size === 1 ? [...origins][0] : "mixed",
    dataStatus: statuses.size === 0 ? null : statuses.size === 1 ? [...statuses][0] : "mixed",
    coverageShare,
    unknownShare: coverageShare === null ? null : Math.round((1 - coverageShare) * 100) / 100,
  };
}

export function normalizeDeploymentArea(value: Partial<DeploymentArea> & { id: string; name: string; polygon: Coordinate[] }): DeploymentArea {
  const createdAt = value.createdAt ?? new Date().toISOString();
  return {
    id: value.id,
    name: value.name,
    municipalityId: value.municipalityId ?? inferMunicipalityId(value.scopeId ?? "", value.scopeName ?? ""),
    scopeId: value.scopeId ?? `unassigned:${value.id}`,
    scopeName: value.scopeName ?? "Nicht zugeordnet",
    polygon: value.polygon,
    hectares: value.hectares && value.hectares > 0 ? value.hectares : calculatePolygonHectares(value.polygon),
    boundaryStatus: value.boundaryStatus ?? "defined",
    focus: value.focus ?? "Allgemeines Waldmonitoring",
    description: value.description ?? "",
    status: value.status ?? "planung",
    dataOrigin: value.dataOrigin ?? "external",
    dataStatus: value.dataStatus ?? "unknown",
    source: value.source ?? "Verwaltungsportal",
    confidence: value.confidence ?? null,
    linkageStatus: value.linkageStatus ?? ((value.municipalityId ?? inferMunicipalityId(value.scopeId ?? "", value.scopeName ?? "")) ? "linked" : "review-needed"),
    createdAt,
    updatedAt: value.updatedAt ?? createdAt,
    archivedAt: value.archivedAt,
  };
}

export function hasDefinedMissionPath(mission: Pick<PlannedMissionRecord, "missionPath">): boolean {
  return mission.missionPath === undefined || Boolean(mission.missionPath && mission.missionPath.waypoints.length >= 2);
}

function municipality(id: string, name: string, type: MunicipalityRecord["type"], region: string, population: number, lat: number, lng: number, administrativeScopeId: string): MunicipalityRecord {
  return { id, name, type, region, population, center: { lat, lng }, administrativeScopeId, status: "active", createdAt: now, updatedAt: now };
}

function stakeholder(id: string, municipalityId: string, name: string, role: string, access: StakeholderRecord["access"]): StakeholderRecord {
  return { id, municipalityId, name, role, access, status: "active", createdAt: now, updatedAt: now };
}

function area(id: string, municipalityId: string, name: string, scopeId: string, scopeName: string, focus: string, status: DeploymentArea["status"], polygon: Coordinate[]): DeploymentArea {
  return normalizeDeploymentArea({ id, municipalityId, name, scopeId, scopeName, focus, status, polygon, dataOrigin: "external", dataStatus: "unknown", source: "Athene Seed" });
}

function plannedMission(id: string, municipalityId: string, areaId: string, title: string, objective: string, priority: PlannedMissionRecord["priority"], seed: string, params: ScenarioParams): PlannedMissionRecord {
  return { id, municipalityId, areaId, title, objective, priority, seed, params, status: "bereit", scenarioName: title, pathName: `${title} Route`, requestedAt: now, createdAt: now, updatedAt: now };
}

function rectangle(south: number, west: number, north: number, east: number): Coordinate[] {
  return [{ lat: south, lng: west }, { lat: north, lng: west }, { lat: north, lng: east }, { lat: south, lng: east }];
}

function inferMunicipalityId(scopeId: string, scopeName: string): string | null {
  const knownByScope: Record<string, string> = {
    "gemeinde-081160019": "mun-esslingen",
    "kreis-45": "mun-remstal",
    "gemeinde-neckartal": "mun-neckartal",
  };
  if (knownByScope[scopeId]) return knownByScope[scopeId];
  const normalized = scopeName.toLocaleLowerCase("de-DE");
  if (normalized === "esslingen am neckar") return "mun-esslingen";
  if (normalized === "rems-murr-kreis") return "mun-remstal";
  if (normalized === "neckartal") return "mun-neckartal";
  return null;
}

function recordSurveyedAt(record: MissionRecord): string | null {
  return record.surveyedAt ?? record.missionCompletedAt ?? record.missionStartedAt ?? record.createdAt ?? null;
}

function numberMetric(record: MissionRecord, key: string): number | null {
  const value = record.metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(values: number[]): number {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function slug(value: string): string {
  return value.toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface ManagementSelection {
  municipalityId: string | null;
  areaId: string | null;
  missionId: string | null;
}

export interface ManagementCollections {
  municipalities: MunicipalityRecord[];
  areas: DeploymentArea[];
  missions: PlannedMissionRecord[];
}

/** Resolves a complete, scoped context. Child IDs always determine/validate their parent IDs. */
export function resolveManagementSelection(
  collections: ManagementCollections,
  requested: Partial<ManagementSelection>,
): ManagementSelection {
  const activeMunicipalities = collections.municipalities.filter((item) => item.status !== "archived");
  const activeAreas = collections.areas.filter((item) => item.status !== "archiviert" && item.municipalityId);
  const missionRequest = requested.missionId ? collections.missions.find((item) => item.id === requested.missionId) : null;
  const areaRequestId = missionRequest?.areaId ?? requested.areaId;
  const areaRequest = areaRequestId ? activeAreas.find((item) => item.id === areaRequestId) : null;
  const municipalityRequestId = areaRequest?.municipalityId ?? missionRequest?.municipalityId ?? requested.municipalityId;
  const municipality = activeMunicipalities.find((item) => item.id === municipalityRequestId) ?? (requested.municipalityId === null ? null : activeMunicipalities[0] ?? null);
  if (!municipality) return { municipalityId: null, areaId: null, missionId: null };

  const scopedAreas = activeAreas.filter((item) => item.municipalityId === municipality.id);
  const area = scopedAreas.find((item) => item.id === areaRequestId) ?? (requested.areaId === null ? null : scopedAreas[0] ?? null);
  if (!area) return { municipalityId: municipality.id, areaId: null, missionId: null };

  const scopedMissions = collections.missions.filter((item) => item.municipalityId === municipality.id && item.areaId === area.id);
  const mission = scopedMissions.find((item) => item.id === requested.missionId) ?? (requested.missionId === null ? null : scopedMissions[0] ?? null);
  return { municipalityId: municipality.id, areaId: area.id, missionId: mission?.id ?? null };
}
