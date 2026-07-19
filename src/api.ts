import { DeploymentArea, MissionRecord, MunicipalityRecord, PlannedMissionRecord, SavedPathRecord, SavedScenarioRecord, StakeholderRecord } from "./domain";

const apiBase = "/api";
const adminTokenStorageKey = "athene.adminAccessToken.v1";

export function hasAdminAccessToken(): boolean {
  return Boolean(window.sessionStorage.getItem(adminTokenStorageKey));
}

export function clearAdminAccessToken(): void {
  window.sessionStorage.removeItem(adminTokenStorageKey);
}

export async function authenticateAdminToken(token: string): Promise<boolean> {
  const response = await fetch(`${apiBase}/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return false;
  const session = await response.json() as { role?: string };
  if (session.role !== "admin") return false;
  window.sessionStorage.setItem(adminTokenStorageKey, token);
  return true;
}

export async function verifyStoredAdminAccess(): Promise<boolean> {
  const token = window.sessionStorage.getItem(adminTokenStorageKey);
  if (!token) return false;
  const response = await fetch(`${apiBase}/auth/session`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return false;
  return ((await response.json()) as { role?: string }).role === "admin";
}

export async function fetchSavedPaths(): Promise<SavedPathRecord[]> {
  return requestJson<SavedPathRecord[]>("/paths");
}

export async function savePathRecord(record: SavedPathRecord): Promise<SavedPathRecord> {
  return requestJson<SavedPathRecord>(`/paths/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

export async function deletePathRecord(pathId: string): Promise<void> {
  await requestEmpty(`/paths/${encodeURIComponent(pathId)}`, { method: "DELETE" });
}

export async function fetchSavedScenarios(): Promise<SavedScenarioRecord[]> {
  return requestJson<SavedScenarioRecord[]>("/scenarios");
}

export async function saveScenarioRecord(record: SavedScenarioRecord): Promise<SavedScenarioRecord> {
  return requestJson<SavedScenarioRecord>(`/scenarios/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

export async function deleteScenarioRecord(scenarioId: string): Promise<void> {
  await requestEmpty(`/scenarios/${encodeURIComponent(scenarioId)}`, { method: "DELETE" });
}

export async function saveMissionRecord(record: MissionRecord): Promise<MissionRecord> {
  return requestJson<MissionRecord>(`/mission-records/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    body: JSON.stringify(record),
  });
}

export async function fetchMissionRecords(): Promise<MissionRecord[]> {
  return requestJson<MissionRecord[]>("/mission-records");
}

export async function deleteMissionRecord(recordId: string): Promise<void> {
  await requestEmpty(`/mission-records/${encodeURIComponent(recordId)}`, { method: "DELETE" });
}

export async function fetchForestAreas(): Promise<DeploymentArea[]> {
  return requestJson<DeploymentArea[]>("/deployment-areas");
}

export async function saveForestArea(area: DeploymentArea): Promise<DeploymentArea> {
  return requestJson<DeploymentArea>(`/deployment-areas/${encodeURIComponent(area.id)}`, {
    method: "PUT",
    body: JSON.stringify(area),
  });
}

export async function fetchMunicipalities(): Promise<MunicipalityRecord[]> {
  return requestJson<MunicipalityRecord[]>("/municipalities");
}

export async function saveMunicipality(record: MunicipalityRecord): Promise<MunicipalityRecord> {
  return requestJson<MunicipalityRecord>(`/municipalities/${encodeURIComponent(record.id)}`, { method: "PUT", body: JSON.stringify(record) });
}

export async function fetchStakeholders(): Promise<StakeholderRecord[]> {
  return requestJson<StakeholderRecord[]>("/stakeholders");
}

export async function saveStakeholder(record: StakeholderRecord): Promise<StakeholderRecord> {
  return requestJson<StakeholderRecord>(`/stakeholders/${encodeURIComponent(record.id)}`, { method: "PUT", body: JSON.stringify(record) });
}

export async function fetchPlannedMissions(): Promise<PlannedMissionRecord[]> {
  return requestJson<PlannedMissionRecord[]>("/planned-missions");
}

export async function savePlannedMission(record: PlannedMissionRecord): Promise<PlannedMissionRecord> {
  return requestJson<PlannedMissionRecord>(`/planned-missions/${encodeURIComponent(record.id)}`, { method: "PUT", body: JSON.stringify(record) });
}

export async function saveMissionBundle(plannedMission: PlannedMissionRecord, missionRecord: MissionRecord): Promise<{ plannedMission: PlannedMissionRecord; missionRecord: MissionRecord }> {
  return requestJson(`/planned-missions/${encodeURIComponent(plannedMission.id)}/result`, {
    method: "PUT",
    body: JSON.stringify({ plannedMission, missionRecord }),
  });
}

export async function deletePlannedMission(missionId: string, deleteResults = false): Promise<void> {
  await requestEmpty(`/planned-missions/${encodeURIComponent(missionId)}?deleteResults=${deleteResults ? "true" : "false"}`, { method: "DELETE" });
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = window.sessionStorage.getItem(adminTokenStorageKey);
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`API ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}

async function requestEmpty(path: string, init?: RequestInit): Promise<void> {
  const token = window.sessionStorage.getItem(adminTokenStorageKey);
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  if (!response.ok) throw new Error(`API ${path} failed: ${response.status}`);
}
