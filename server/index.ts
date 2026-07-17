import cors from "cors";
import express from "express";
import { ForestDrawingArea, MissionRecord, SavedPathRecord, SavedScenarioRecord } from "../src/domain.js";
import { readDatabase, updateDatabase } from "./store.js";

const app = express();
const port = Number(process.env.ATHENE_API_PORT ?? 8787);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_request, response) => {
  const database = await readDatabase();
  response.json({
    ok: true,
    service: "athene-api",
    counts: {
      paths: database.savedPaths.length,
      scenarios: database.savedScenarios.length,
      missionRecords: database.missionRecords.length,
      forestAreas: database.forestAreas.length,
    },
  });
});

app.get("/api/paths", async (_request, response) => {
  const database = await readDatabase();
  response.json(database.savedPaths);
});

app.put("/api/paths/:id", async (request, response) => {
  const record = ensurePathRecord({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.savedPaths = [record, ...database.savedPaths.filter((path) => path.id !== record.id && path.name !== record.name)];
    return record;
  });
  response.json(saved);
});

app.delete("/api/paths/:id", async (request, response) => {
  await updateDatabase((database) => {
    database.savedPaths = database.savedPaths.filter((path) => path.id !== request.params.id);
  });
  response.status(204).end();
});

app.get("/api/scenarios", async (_request, response) => {
  const database = await readDatabase();
  response.json(database.savedScenarios);
});

app.put("/api/scenarios/:id", async (request, response) => {
  const record = ensureScenarioRecord({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.savedScenarios = [record, ...database.savedScenarios.filter((scenario) => scenario.id !== record.id && scenario.name !== record.name)];
    return record;
  });
  response.json(saved);
});

app.delete("/api/scenarios/:id", async (request, response) => {
  await updateDatabase((database) => {
    database.savedScenarios = database.savedScenarios.filter((scenario) => scenario.id !== request.params.id);
  });
  response.status(204).end();
});

app.get("/api/mission-records", async (_request, response) => {
  const database = await readDatabase();
  response.json(database.missionRecords);
});

app.put("/api/mission-records/:id", async (request, response) => {
  const record = ensureMissionRecord({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.missionRecords = [record, ...database.missionRecords.filter((missionRecord) => missionRecord.id !== record.id)];
    return record;
  });
  response.json(saved);
});

app.delete("/api/mission-records/:id", async (request, response) => {
  await updateDatabase((database) => {
    database.missionRecords = database.missionRecords.filter((missionRecord) => missionRecord.id !== request.params.id);
  });
  response.status(204).end();
});

app.get("/api/forest-areas", async (_request, response) => {
  const database = await readDatabase();
  response.json(database.forestAreas);
});

app.put("/api/forest-areas/:id", async (request, response) => {
  const area = ensureForestDrawingArea({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.forestAreas = [area, ...database.forestAreas.filter((forestArea) => forestArea.id !== area.id)];
    return area;
  });
  response.json(saved);
});

app.delete("/api/forest-areas/:id", async (request, response) => {
  await updateDatabase((database) => {
    database.forestAreas = database.forestAreas.filter((forestArea) => forestArea.id !== request.params.id);
  });
  response.status(204).end();
});

app.get("/api/copernicus/status", (_request, response) => {
  response.json({
    configured: Boolean(process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET),
    catalogUrl: process.env.COPERNICUS_CATALOG_URL ?? "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search",
    processUrl: process.env.COPERNICUS_PROCESS_URL ?? "https://sh.dataspace.copernicus.eu/api/v1/process",
  });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown API error";
  response.status(400).json({ error: message });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Athene API listening on http://127.0.0.1:${port}`);
});

function ensurePathRecord(value: unknown): SavedPathRecord {
  const record = value as SavedPathRecord;
  if (!record?.id || !record.name || !record.savedAt || !Array.isArray(record.waypoints)) throw new Error("Invalid path record");
  return record;
}

function ensureScenarioRecord(value: unknown): SavedScenarioRecord {
  const record = value as SavedScenarioRecord;
  if (!record?.id || !record.name || !record.savedAt || !record.seed || !record.params || !Array.isArray(record.waypoints)) {
    throw new Error("Invalid scenario record");
  }
  return record;
}

function ensureMissionRecord(value: unknown): MissionRecord {
  const record = value as MissionRecord;
  if (!record?.id || !record.missionId || !record.scenarioName || !record.createdAt || !record.summary || !Array.isArray(record.recommendations)) {
    throw new Error("Invalid mission record");
  }
  return record;
}

function ensureForestDrawingArea(value: unknown): ForestDrawingArea {
  const area = value as ForestDrawingArea;
  if (!area?.id || !area.name || !area.scopeId || !area.scopeName || !area.createdAt || !Array.isArray(area.polygon) || area.polygon.length < 3) {
    throw new Error("Invalid forest area");
  }
  return area;
}
