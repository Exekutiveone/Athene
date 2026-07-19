import test from "node:test";
import assert from "node:assert/strict";
import { generateCopernicusDemoAnalysis } from "../src/copernicus.js";
import { defaultScenarioParams, generateScenario } from "../src/generator.js";

test("Copernicus fallback remains explicitly synthetic and modeled", () => {
  const analysis = generateCopernicusDemoAnalysis(generateScenario("copernicus-fallback-test", defaultScenarioParams));
  assert.match(analysis.scene.source, /synthetischer .*Demofallback/i);
  assert.ok(analysis.cells.some((cell) => cell.dataStatus === "modeled" && cell.dataOrigin === "synthetic"));
  assert.ok(analysis.cells.some((cell) => cell.dataStatus === "unknown" && cell.value === null));
  assert.ok(analysis.cells.every((cell) => cell.modelVersion === "copernicus-demo-0.1.0"));
});
