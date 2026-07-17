import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DeploymentArea, MissionRecord, MunicipalityRecord, PlannedMissionRecord, SavedPathRecord, SavedScenarioRecord, StakeholderRecord } from "../src/domain.js";
import { normalizeDeploymentArea, seedDeploymentAreas, seedMunicipalities, seedPlannedMissions, seedStakeholders } from "../src/management.js";

export interface AtheneDatabase {
  version: 2;
  savedPaths: SavedPathRecord[];
  savedScenarios: SavedScenarioRecord[];
  missionRecords: MissionRecord[];
  deploymentAreas: DeploymentArea[];
  municipalities: MunicipalityRecord[];
  stakeholders: StakeholderRecord[];
  plannedMissions: PlannedMissionRecord[];
}

const defaultDatabase: AtheneDatabase = {
  version: 2,
  savedPaths: [],
  savedScenarios: [],
  missionRecords: [],
  deploymentAreas: structuredClone(seedDeploymentAreas),
  municipalities: structuredClone(seedMunicipalities),
  stakeholders: structuredClone(seedStakeholders),
  plannedMissions: structuredClone(seedPlannedMissions),
};

export const databasePath = resolve(process.cwd(), ".data", "athene-db.json");
const updateQueues = new Map<string, Promise<void>>();

export async function readDatabase(): Promise<AtheneDatabase> {
  return readDatabaseFrom(databasePath);
}

export async function readDatabaseFrom(path: string): Promise<AtheneDatabase> {
  try {
    const raw = await readFile(path, "utf8");
    return normalizeDatabase(JSON.parse(raw));
  } catch (error) {
    if (!isEnoent(error)) throw error;
    await writeDatabaseTo(path, defaultDatabase);
    return structuredClone(defaultDatabase);
  }
}

export async function writeDatabase(database: AtheneDatabase): Promise<void> {
  return writeDatabaseTo(databasePath, database);
}

export async function writeDatabaseTo(path: string, database: AtheneDatabase): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await rename(tmpPath, path);
}

export async function updateDatabase<T>(updater: (database: AtheneDatabase) => T | Promise<T>): Promise<T> {
  return updateDatabaseAt(databasePath, updater);
}

export async function updateDatabaseAt<T>(path: string, updater: (database: AtheneDatabase) => T | Promise<T>): Promise<T> {
  const queue = updateQueues.get(path) ?? Promise.resolve();
  const operation = queue.then(async () => {
    const database = await readDatabaseFrom(path);
    const result = await updater(database);
    await writeDatabaseTo(path, database);
    return result;
  });
  const settled = operation.then(() => undefined, () => undefined);
  updateQueues.set(path, settled);
  void settled.finally(() => {
    if (updateQueues.get(path) === settled) updateQueues.delete(path);
  });
  return operation;
}

export function normalizeDatabase(value: unknown): AtheneDatabase {
  const database = value as Partial<AtheneDatabase> & { forestAreas?: unknown[] };
  const rawAreas = Array.isArray(database.deploymentAreas)
    ? database.deploymentAreas
    : Array.isArray(database.forestAreas)
      ? database.forestAreas
      : seedDeploymentAreas;
  const deploymentAreas = rawAreas.filter(isLegacyArea).map((area) => normalizeDeploymentArea(area));
  return {
    version: 2,
    savedPaths: Array.isArray(database.savedPaths) ? database.savedPaths.filter(isSavedPathRecord) : [],
    savedScenarios: Array.isArray(database.savedScenarios) ? database.savedScenarios.filter(isSavedScenarioRecord) : [],
    missionRecords: Array.isArray(database.missionRecords) ? database.missionRecords.filter(isMissionRecord).map((record) => normalizeMissionRecord(record, deploymentAreas)) : [],
    deploymentAreas,
    municipalities: Array.isArray(database.municipalities) ? database.municipalities.filter(isMunicipality).map(normalizeMunicipality) : structuredClone(seedMunicipalities),
    stakeholders: Array.isArray(database.stakeholders) ? database.stakeholders.filter(isStakeholder).map(normalizeStakeholder) : structuredClone(seedStakeholders),
    plannedMissions: Array.isArray(database.plannedMissions) ? database.plannedMissions.filter(isPlannedMission) : structuredClone(seedPlannedMissions),
  };
}

function isSavedPathRecord(value: unknown): value is SavedPathRecord {
  const record = value as SavedPathRecord;
  return Boolean(record?.id && record.name && record.savedAt && Array.isArray(record.waypoints));
}

function isSavedScenarioRecord(value: unknown): value is SavedScenarioRecord {
  const record = value as SavedScenarioRecord;
  return Boolean(record?.id && record.name && record.savedAt && record.seed && record.params && Array.isArray(record.waypoints));
}

function isMissionRecord(value: unknown): value is MissionRecord {
  const record = value as MissionRecord;
  return Boolean(record?.id && record.missionId && record.createdAt && record.summary && Array.isArray(record.recommendations));
}

function isLegacyArea(value: unknown): value is DeploymentArea {
  const area = value as DeploymentArea;
  return Boolean(area?.id && area.name && area.scopeId && area.scopeName && area.createdAt && Array.isArray(area.polygon));
}

function isMunicipality(value: unknown): value is MunicipalityRecord {
  const record = value as MunicipalityRecord;
  return Boolean(record?.id && record.name && record.region && record.center);
}

function isStakeholder(value: unknown): value is StakeholderRecord {
  const record = value as StakeholderRecord;
  return Boolean(record?.id && record.municipalityId && record.name && record.role);
}

function isPlannedMission(value: unknown): value is PlannedMissionRecord {
  const record = value as PlannedMissionRecord;
  return Boolean(record?.id && record.municipalityId && record.areaId && record.title && record.params);
}

function normalizeMissionRecord(record: MissionRecord, areas: DeploymentArea[]): MissionRecord {
  const area = areas.find((candidate) => candidate.id === record.areaId || candidate.name === record.forestAreaName);
  const areaId = record.areaId ?? area?.id ?? null;
  const municipalityId = record.municipalityId ?? area?.municipalityId ?? null;
  return {
    ...record,
    areaId,
    municipalityId,
    dataOrigin: record.dataOrigin ?? "synthetic",
    dataStatus: record.dataStatus ?? "simulated",
    confidence: record.confidence ?? (typeof record.metrics?.averageConfidence === "number" ? record.metrics.averageConfidence : null),
    source: record.source ?? record.generatorVersion ?? "Athene Mission Record",
    missionStartedAt: record.missionStartedAt ?? null,
    missionCompletedAt: record.missionCompletedAt ?? null,
    surveyedAt: record.surveyedAt ?? record.missionCompletedAt ?? record.missionStartedAt ?? record.createdAt ?? null,
    coverageShare: typeof record.coverageShare === "number" ? record.coverageShare : null,
    unknownShare: typeof record.unknownShare === "number" ? record.unknownShare : null,
    linkageStatus: areaId && municipalityId ? "linked" : "review-needed",
  };
}

function normalizeMunicipality(record: MunicipalityRecord): MunicipalityRecord {
  return { ...record, status: record.status ?? "active", administrativeScopeId: record.administrativeScopeId ?? null };
}

function normalizeStakeholder(record: StakeholderRecord): StakeholderRecord {
  return { ...record, status: record.status ?? "active" };
}

function isEnoent(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}
