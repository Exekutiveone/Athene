import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeManagementMutation, enqueueManagementMutation, flushManagementOutbox, mergePendingEntities, readManagementOutbox } from "../src/managementOutbox.js";
import { seedMunicipalities } from "../src/management.js";

test("outbox deduplicates entity mutations and keeps failed writes pending", async () => {
  const storage = new MemoryStorage();
  const first = { ...seedMunicipalities[0], name: "First edit" };
  const final = { ...seedMunicipalities[0], name: "Final edit" };
  enqueueManagementMutation("municipality", first, storage);
  enqueueManagementMutation("municipality", final, storage);
  assert.equal(readManagementOutbox(storage).length, 1);
  assert.equal(readManagementOutbox(storage)[0].payload.name, "Final edit");

  const result = await flushManagementOutbox(async () => { throw new Error("offline"); }, storage);
  assert.equal(result.synced, 0);
  assert.equal(result.pending.length, 1);
});

test("dirty local entities win over stale refresh data until acknowledged", () => {
  const storage = new MemoryStorage();
  const local = { ...seedMunicipalities[0], name: "Local edit" };
  const remote = { ...seedMunicipalities[0], name: "Stale server value" };
  const pending = enqueueManagementMutation("municipality", local, storage);
  assert.equal(mergePendingEntities([remote], [local], pending, "municipality")[0].name, "Local edit");
  assert.equal(acknowledgeManagementMutation("municipality", local.id, storage).length, 0);
});

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
