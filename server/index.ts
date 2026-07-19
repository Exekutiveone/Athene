import cors from "cors";
import express from "express";
import { readDatabase, updateDatabase } from "./store.js";
import { ensureDeploymentArea, ensureMissionRecord, ensureMunicipality, ensurePathRecord, ensurePlannedMission, ensureScenarioRecord, ensureStakeholder } from "./validation.js";
import { fetchOsmWays, parseOsmBounds, prepareOsmWays } from "./osmProxy.js";
import { requireAdminForMutation, resolveRole } from "./auth.js";

const app = express();
const port = Number(process.env.ATHENE_API_PORT ?? 8787);
const asyncRoute = (handler: express.RequestHandler): express.RequestHandler => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/auth/session", (request, response) => {
  response.json({ role: resolveRole(request.header("authorization")) });
});

app.use("/api", requireAdminForMutation());

app.get("/api/health", asyncRoute(async (_request, response) => {
  const database = await readDatabase();
  response.json({
    ok: true,
    service: "athene-api",
    counts: {
      paths: database.savedPaths.length,
      scenarios: database.savedScenarios.length,
      missionRecords: database.missionRecords.length,
      deploymentAreas: database.deploymentAreas.length,
      municipalities: database.municipalities.length,
      stakeholders: database.stakeholders.length,
      plannedMissions: database.plannedMissions.length,
    },
  });
}));

app.get("/api/paths", asyncRoute(async (_request, response) => {
  const database = await readDatabase();
  response.json(database.savedPaths);
}));

app.put("/api/paths/:id", asyncRoute(async (request, response) => {
  const record = ensurePathRecord({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.savedPaths = [record, ...database.savedPaths.filter((path) => path.id !== record.id && path.name !== record.name)];
    return record;
  });
  response.json(saved);
}));

app.delete("/api/paths/:id", asyncRoute(async (request, response) => {
  await updateDatabase((database) => {
    database.savedPaths = database.savedPaths.filter((path) => path.id !== request.params.id);
  });
  response.status(204).end();
}));

app.get("/api/scenarios", asyncRoute(async (_request, response) => {
  const database = await readDatabase();
  response.json(database.savedScenarios);
}));

app.put("/api/scenarios/:id", asyncRoute(async (request, response) => {
  const record = ensureScenarioRecord({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.savedScenarios = [record, ...database.savedScenarios.filter((scenario) => scenario.id !== record.id && scenario.name !== record.name)];
    return record;
  });
  response.json(saved);
}));

app.delete("/api/scenarios/:id", asyncRoute(async (request, response) => {
  await updateDatabase((database) => {
    database.savedScenarios = database.savedScenarios.filter((scenario) => scenario.id !== request.params.id);
  });
  response.status(204).end();
}));

app.get("/api/mission-records", asyncRoute(async (_request, response) => {
  const database = await readDatabase();
  response.json(database.missionRecords);
}));

app.put("/api/mission-records/:id", asyncRoute(async (request, response) => {
  const record = ensureMissionRecord({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.missionRecords = [record, ...database.missionRecords.filter((missionRecord) => missionRecord.id !== record.id)];
    return record;
  });
  response.json(saved);
}));

app.delete("/api/mission-records/:id", asyncRoute(async (request, response) => {
  await updateDatabase((database) => {
    database.missionRecords = database.missionRecords.filter((missionRecord) => missionRecord.id !== request.params.id);
  });
  response.status(204).end();
}));

app.get("/api/deployment-areas", asyncRoute(async (_request, response) => {
  const database = await readDatabase();
  response.json(database.deploymentAreas);
}));

app.put("/api/deployment-areas/:id", asyncRoute(async (request, response) => {
  const area = ensureDeploymentArea({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.deploymentAreas = [area, ...database.deploymentAreas.filter((candidate) => candidate.id !== area.id)];
    return area;
  });
  response.json(saved);
}));

// Compatibility read endpoint for clients from schema v1. New clients archive instead of deleting.
app.get("/api/forest-areas", asyncRoute(async (_request, response) => {
  const database = await readDatabase();
  response.json(database.deploymentAreas);
}));

app.put("/api/forest-areas/:id", asyncRoute(async (request, response) => {
  const area = ensureDeploymentArea({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.deploymentAreas = [area, ...database.deploymentAreas.filter((candidate) => candidate.id !== area.id)];
    return area;
  });
  response.json(saved);
}));

app.get("/api/municipalities", asyncRoute(async (_request, response) => {
  response.json((await readDatabase()).municipalities);
}));

app.put("/api/municipalities/:id", asyncRoute(async (request, response) => {
  const record = ensureMunicipality({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.municipalities = [record, ...database.municipalities.filter((candidate) => candidate.id !== record.id)];
    return record;
  });
  response.json(saved);
}));

app.get("/api/stakeholders", asyncRoute(async (_request, response) => {
  response.json((await readDatabase()).stakeholders);
}));

app.put("/api/stakeholders/:id", asyncRoute(async (request, response) => {
  const record = ensureStakeholder({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.stakeholders = [record, ...database.stakeholders.filter((candidate) => candidate.id !== record.id)];
    return record;
  });
  response.json(saved);
}));

app.get("/api/planned-missions", asyncRoute(async (_request, response) => {
  response.json((await readDatabase()).plannedMissions);
}));

app.put("/api/planned-missions/:id", asyncRoute(async (request, response) => {
  const record = ensurePlannedMission({ ...request.body, id: request.params.id });
  const saved = await updateDatabase((database) => {
    database.plannedMissions = [record, ...database.plannedMissions.filter((candidate) => candidate.id !== record.id)];
    return record;
  });
  response.json(saved);
}));

app.put("/api/planned-missions/:id/result", asyncRoute(async (request, response) => {
  const plannedMission = ensurePlannedMission({ ...request.body?.plannedMission, id: request.params.id });
  const missionRecord = ensureMissionRecord(request.body?.missionRecord);
  if (missionRecord.missionId !== plannedMission.id) throw new Error("Mission result does not belong to planned mission");
  const saved = await updateDatabase((database) => {
    database.plannedMissions = [plannedMission, ...database.plannedMissions.filter((candidate) => candidate.id !== plannedMission.id)];
    database.missionRecords = [missionRecord, ...database.missionRecords.filter((candidate) => candidate.id !== missionRecord.id)];
    return { plannedMission, missionRecord };
  });
  response.json(saved);
}));

app.delete("/api/planned-missions/:id", asyncRoute(async (request, response) => {
  await updateDatabase((database) => {
    database.plannedMissions = database.plannedMissions.filter((candidate) => candidate.id !== request.params.id);
    if (request.query.deleteResults === "true") database.missionRecords = database.missionRecords.filter((candidate) => candidate.missionId !== request.params.id);
  });
  response.status(204).end();
}));

app.get("/api/copernicus/status", (_request, response) => {
  response.json({
    configured: Boolean(process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET),
    catalogUrl: process.env.COPERNICUS_CATALOG_URL ?? "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search",
    processUrl: process.env.COPERNICUS_PROCESS_URL ?? "https://sh.dataspace.copernicus.eu/api/v1/process",
  });
});

app.get("/api/osm-forest-paths", asyncRoute(async (request, response) => {
  const bounds = parseOsmBounds(request.query);
  const result = await fetchOsmWays(bounds);
  const areaId = typeof request.query.areaId === "string" ? request.query.areaId : null;
  if (areaId) {
    const area = (await readDatabase()).deploymentAreas.find((candidate) => candidate.id === areaId);
    if (!area) throw new Error("Unknown deployment area");
    const prepared = prepareOsmWays(result.payload, area.polygon, `${area.id}:${area.updatedAt}:2.5`, 2.5);
    response.setHeader("X-Athene-Cache", result.cacheStatus === "HIT" && prepared.cacheStatus === "HIT" ? "HIT" : "MISS");
    response.json({ paths: prepared.paths });
    return;
  }
  response.setHeader("X-Athene-Cache", result.cacheStatus);
  response.json(result.payload);
}));

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown API error";
  response.status(400).json({ error: message });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`Athene API listening on http://127.0.0.1:${port}`);
});
