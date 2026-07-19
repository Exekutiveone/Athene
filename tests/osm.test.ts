import assert from "node:assert/strict";
import test from "node:test";
import { parseOsmBounds, prepareOsmWays } from "../server/osmProxy.js";
import { clipWayToPolygon, fetchOsmForestPaths } from "../src/osmForestPaths.js";
import { seedDeploymentAreas } from "../src/management.js";

test("OSM proxy bounds reject malformed and oversized requests", () => {
  assert.deepEqual(parseOsmBounds({ south: "48", west: "9", north: "48.1", east: "9.1" }), [48, 9, 48.1, 9.1]);
  assert.throws(() => parseOsmBounds({ south: "x", west: "9", north: "48", east: "10" }), /Invalid OSM bounding box/);
  assert.throws(() => parseOsmBounds({ south: "47", west: "9", north: "49", east: "10" }), /outside allowed size/);
});

test("crossing OSM ways are clipped to the forest boundary", () => {
  const polygon = [{ lat: 48, lng: 9 }, { lat: 48, lng: 9.01 }, { lat: 48.01, lng: 9.01 }, { lat: 48.01, lng: 9 }];
  const parts = clipWayToPolygon([{ lat: 48.005, lng: 8.99 }, { lat: 48.005, lng: 9.02 }], polygon);
  assert.equal(parts.length, 1);
  assert.ok(Math.abs(parts[0][0].lng - 9) < 1e-9);
  assert.ok(Math.abs(parts[0][1].lng - 9.01) < 1e-9);
});

test("server prepares clipped and simplified forest paths before browser delivery", () => {
  const polygon = [{ lat: 48, lng: 9 }, { lat: 48, lng: 9.01 }, { lat: 48.01, lng: 9.01 }, { lat: 48.01, lng: 9 }];
  const payload = { elements: [{ type: "way", id: 42, tags: { highway: "track", name: "Testweg" }, geometry: [{ lat: 48.005, lon: 8.99 }, { lat: 48.005, lon: 9.005 }, { lat: 48.005, lon: 9.02 }] }] };
  const prepared = prepareOsmWays(payload, polygon, "test-area-v1", 2.5);
  assert.equal(prepared.paths.length, 1);
  assert.equal(prepared.paths[0].name, "Testweg");
  assert.ok(prepared.paths[0].coordinates.every((point) => point.lng >= 9 && point.lng <= 9.01));
  assert.equal(prepareOsmWays(payload, polygon, "test-area-v1", 2.5).cacheStatus, "HIT");
});

test("an empty OSM response is reported as an error instead of a successful empty network", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ elements: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  const progress: string[] = [];
  try {
    await assert.rejects(fetchOsmForestPaths({ ...seedDeploymentAreas[0], id: "empty-osm-test", updatedAt: "empty-osm-test" }, new AbortController().signal, (state) => progress.push(state.stage)), /keine.*Weg/i);
    assert.equal(progress.at(-1), "error");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
