import assert from "node:assert/strict";
import test from "node:test";
import type { Waypoint } from "../src/domain.js";
import { createMissionPath, missionPathSegments, missionPathWaypointsFlat } from "../src/routeGeometry.js";

const waypoint = (id: string, lat: number, lng: number, breakBefore = false): Waypoint => ({ id, lat, lng, breakBefore: breakBefore || undefined, sequence: 1, minute: 0, speedKmh: 3 });

test("mission paths preserve disconnected route segments without inventing connectors", () => {
  const path = createMissionPath("Mehrteilig", [
    waypoint("a", 48.1, 9.1), waypoint("b", 48.2, 9.2),
    waypoint("c", 49.1, 10.1, true), waypoint("d", 49.2, 10.2),
  ]);
  assert.equal(path.segments?.length, 2);
  assert.deepEqual(missionPathSegments(path).map((segment) => segment.map((point) => point.id)), [["a", "b"], ["c", "d"]]);
  assert.equal(missionPathWaypointsFlat(path)[2].breakBefore, true);
});

test("legacy flattened mission paths remain readable", () => {
  const legacy = { name: "Alt", waypoints: [waypoint("a", 48.1, 9.1), waypoint("b", 48.2, 9.2)] };
  assert.equal(missionPathSegments(legacy).length, 1);
});
