import test from "node:test";
import assert from "node:assert/strict";
import { estimateSpatialConfidence, shouldRenderHeatmapCell } from "../src/heatmapPolicy.js";

test("full interpolation renders the entire polygon while confidence fades with distance", () => {
  assert.equal(shouldRenderHeatmapCell("full", 500, 0.01, 30, 0.45), true);
  assert.ok(estimateSpatialConfidence(0.9, 150) < estimateSpatialConfidence(0.9, 20));
});

test("confidence-limited interpolation enforces distance and confidence controls", () => {
  assert.equal(shouldRenderHeatmapCell("confidence", 30, 0.45, 30, 0.45), true);
  assert.equal(shouldRenderHeatmapCell("confidence", 31, 0.9, 30, 0.45), false);
  assert.equal(shouldRenderHeatmapCell("confidence", 10, 0.44, 30, 0.45), false);
});
