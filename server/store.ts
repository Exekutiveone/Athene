import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ForestDrawingArea, MissionRecord, SavedPathRecord, SavedScenarioRecord } from "../src/domain.js";

export interface AtheneDatabase {
  version: 1;
  savedPaths: SavedPathRecord[];
  savedScenarios: SavedScenarioRecord[];
  missionRecords: MissionRecord[];
  forestAreas: ForestDrawingArea[];
}

const defaultDatabase: AtheneDatabase = {
  version: 1,
  savedPaths: [],
  savedScenarios: [],
  missionRecords: [],
  forestAreas: [],
};

const databasePath = resolve(process.cwd(), ".data", "athene-db.json");

export async function readDatabase(): Promise<AtheneDatabase> {
  try {
    const raw = await readFile(databasePath, "utf8");
    return normalizeDatabase(JSON.parse(raw));
  } catch {
    await writeDatabase(defaultDatabase);
    return structuredClone(defaultDatabase);
  }
}

export async function writeDatabase(database: AtheneDatabase): Promise<void> {
  await mkdir(dirname(databasePath), { recursive: true });
  const tmpPath = `${databasePath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
  await rename(tmpPath, databasePath);
}

export async function updateDatabase<T>(updater: (database: AtheneDatabase) => T | Promise<T>): Promise<T> {
  const database = await readDatabase();
  const result = await updater(database);
  await writeDatabase(database);
  return result;
}

function normalizeDatabase(value: unknown): AtheneDatabase {
  const database = value as Partial<AtheneDatabase>;
  return {
    version: 1,
    savedPaths: Array.isArray(database.savedPaths) ? database.savedPaths.filter(isSavedPathRecord) : [],
    savedScenarios: Array.isArray(database.savedScenarios) ? database.savedScenarios.filter(isSavedScenarioRecord) : [],
    missionRecords: Array.isArray(database.missionRecords) ? database.missionRecords.filter(isMissionRecord) : [],
    forestAreas: Array.isArray(database.forestAreas) ? database.forestAreas.filter(isForestDrawingArea) : [],
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

function isForestDrawingArea(value: unknown): value is ForestDrawingArea {
  const area = value as ForestDrawingArea;
  return Boolean(area?.id && area.name && area.scopeId && area.scopeName && area.createdAt && Array.isArray(area.polygon));
}
