import type { Coordinate } from "../domain";
import { estimateSpatialConfidence, shouldRenderHeatmapCell } from "../heatmapPolicy";

interface RequestPayload {
  id: number;
  polygon: Coordinate[];
  observations: Array<Coordinate & { value: number; confidence: number }>;
  colorLookup: Array<[number, number, number]>;
  mode: "full" | "confidence";
  maxDistanceMeters: number;
  minConfidence: number;
}

self.onmessage = async (event: MessageEvent<RequestPayload>) => {
  const { id, polygon, observations, colorLookup, mode, maxDistanceMeters, minConfidence } = event.data;
  const bounds = coordinateBounds(polygon);
  if (!bounds || observations.length === 0) {
    self.postMessage({ id, error: "Keine Heatmap-Daten" });
    return;
  }
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  const meanLatRadians = ((minLat + maxLat) * 0.5 * Math.PI) / 180;
  const widthMeters = Math.max(1, (maxLng - minLng) * 111_320 * Math.cos(meanLatRadians));
  const heightMeters = Math.max(1, (maxLat - minLat) * 111_320);
  const longestSide = observations.length > 1500 ? 180 : 240;
  const width = Math.max(32, Math.round(longestSide * widthMeters / Math.max(widthMeters, heightMeters)));
  const height = Math.max(32, Math.round(longestSide * heightMeters / Math.max(widthMeters, heightMeters)));
  const canvas = new OffscreenCanvas(width * 2, height * 2);
  const source = new OffscreenCanvas(width, height);
  const sourceContext = source.getContext("2d");
  const context = canvas.getContext("2d");
  if (!sourceContext || !context) return self.postMessage({ id, error: "Canvas nicht verfügbar" });
  const pixels = sourceContext.createImageData(width, height);
  const projected = observations.map((point) => ({ x: (point.lng - minLng) * 111_320 * Math.cos(meanLatRadians), y: (point.lat - minLat) * 111_320, value: point.value, confidence: point.confidence }));
  const neighbourCount = Math.min(6, projected.length);
  const distances = new Float64Array(neighbourCount);
  const values = new Float64Array(neighbourCount);
  const confidences = new Float64Array(neighbourCount);
  for (let y = 0; y < height; y += 1) {
    const lat = maxLat - ((y + 0.5) / height) * (maxLat - minLat);
    const projectedY = (lat - minLat) * 111_320;
    for (let x = 0; x < width; x += 1) {
      const lng = minLng + ((x + 0.5) / width) * (maxLng - minLng);
      if (!coordinateInPolygon({ lat, lng }, polygon)) continue;
      const projectedX = (lng - minLng) * 111_320 * Math.cos(meanLatRadians);
      distances.fill(Number.POSITIVE_INFINITY);
      for (const observation of projected) {
        const distance = (observation.x - projectedX) ** 2 + (observation.y - projectedY) ** 2;
        if (distance >= distances[neighbourCount - 1]) continue;
        let at = neighbourCount - 1;
        while (at > 0 && distance < distances[at - 1]) { distances[at] = distances[at - 1]; values[at] = values[at - 1]; confidences[at] = confidences[at - 1]; at -= 1; }
        distances[at] = distance; values[at] = observation.value; confidences[at] = observation.confidence;
      }
      let weighted = 0; let weightedConfidence = 0; let weightSum = 0;
      for (let index = 0; index < neighbourCount; index += 1) { const weight = 1 / Math.max(49, distances[index]); weighted += values[index] * weight; weightedConfidence += confidences[index] * weight; weightSum += weight; }
      const nearestDistance = Math.sqrt(distances[0]);
      const confidence = estimateSpatialConfidence(weightedConfidence / Math.max(weightSum, Number.EPSILON), nearestDistance);
      if (!shouldRenderHeatmapCell(mode, nearestDistance, confidence, maxDistanceMeters, minConfidence)) continue;
      const color = colorLookup[Math.max(0, Math.min(255, Math.round(weighted / Math.max(weightSum, Number.EPSILON) * 255)))] ?? colorLookup[0];
      const alpha = mode === "full" ? Math.round(70 + 165 * Math.max(0, Math.min(1, confidence))) : 235;
      pixels.data.set([...color, alpha], (y * width + x) * 4);
    }
  }
  sourceContext.putImageData(pixels, 0, 0);
  context.imageSmoothingEnabled = true;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  self.postMessage({ id, blob, bounds });
};

function coordinateBounds(points: Coordinate[]): [[number, number], [number, number]] | null {
  return points.length ? [[Math.min(...points.map((p) => p.lat)), Math.min(...points.map((p) => p.lng))], [Math.max(...points.map((p) => p.lat)), Math.max(...points.map((p) => p.lng))]] : null;
}

function coordinateInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]; const prior = polygon[previous];
    if ((current.lat > point.lat) !== (prior.lat > point.lat) && point.lng < ((prior.lng - current.lng) * (point.lat - current.lat)) / (prior.lat - current.lat) + current.lng) inside = !inside;
  }
  return inside;
}
