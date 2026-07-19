import assert from "node:assert/strict";
import test from "node:test";
import { parseHeatmapColor } from "../src/hooks/useForestHeatmap.js";

test("worker heatmap palette accepts generated rgb and hex colors", () => {
  assert.deepEqual(parseHeatmapColor("rgb(16, 185, 129)"), [16, 185, 129]);
  assert.deepEqual(parseHeatmapColor("#dc2626"), [220, 38, 38]);
});
