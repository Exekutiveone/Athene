import { DeploymentArea, MunicipalityRecord, PlannedMissionRecord, StakeholderRecord } from "./domain.js";

export type ManagementEntityKind = "area" | "municipality" | "stakeholder" | "mission";
export type ManagementEntity = DeploymentArea | MunicipalityRecord | StakeholderRecord | PlannedMissionRecord;

export interface ManagementMutation {
  key: string;
  kind: ManagementEntityKind;
  entityId: string;
  payload: ManagementEntity;
  queuedAt: string;
}

const outboxKey = "athene.managementOutbox.v1";

export function readManagementOutbox(storage: Storage = window.localStorage): ManagementMutation[] {
  try {
    const parsed = JSON.parse(storage.getItem(outboxKey) ?? "[]") as ManagementMutation[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.key && item.entityId && item.kind && item.payload) : [];
  } catch {
    return [];
  }
}

export function enqueueManagementMutation(kind: ManagementEntityKind, payload: ManagementEntity, storage: Storage = window.localStorage): ManagementMutation[] {
  const mutation: ManagementMutation = { key: `${kind}:${payload.id}`, kind, entityId: payload.id, payload, queuedAt: new Date().toISOString() };
  const next = [mutation, ...readManagementOutbox(storage).filter((item) => item.key !== mutation.key)];
  storage.setItem(outboxKey, JSON.stringify(next));
  return next;
}

export function acknowledgeManagementMutation(kind: ManagementEntityKind, entityId: string, storage: Storage = window.localStorage): ManagementMutation[] {
  const next = readManagementOutbox(storage).filter((item) => item.key !== `${kind}:${entityId}`);
  storage.setItem(outboxKey, JSON.stringify(next));
  return next;
}

export async function flushManagementOutbox(
  sync: (mutation: ManagementMutation) => Promise<unknown>,
  storage: Storage = window.localStorage,
): Promise<{ pending: ManagementMutation[]; synced: number }> {
  const queued = readManagementOutbox(storage).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  const pending: ManagementMutation[] = [];
  let synced = 0;
  for (const mutation of queued) {
    try {
      await sync(mutation);
      synced += 1;
    } catch {
      pending.push(mutation);
    }
  }
  storage.setItem(outboxKey, JSON.stringify(pending));
  return { pending, synced };
}

export function mergePendingEntities<T extends { id: string }>(remote: T[], local: T[], pending: ManagementMutation[], kind: ManagementEntityKind): T[] {
  const dirtyIds = new Set(pending.filter((item) => item.kind === kind).map((item) => item.entityId));
  const dirty = local.filter((item) => dirtyIds.has(item.id));
  return [...dirty, ...remote.filter((item) => !dirtyIds.has(item.id))];
}
