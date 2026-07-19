export type HeatmapInterpolationMode = "full" | "confidence";

export function estimateSpatialConfidence(baseConfidence: number, nearestDistanceMeters: number): number {
  return clamp01(baseConfidence) * Math.exp(-Math.max(0, nearestDistanceMeters) / 120);
}

export function shouldRenderHeatmapCell(mode: HeatmapInterpolationMode, nearestDistanceMeters: number, confidence: number, maxDistanceMeters: number, minConfidence: number): boolean {
  if (mode === "full") return true;
  return nearestDistanceMeters <= maxDistanceMeters && confidence >= minConfidence;
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
