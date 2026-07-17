import {
  CoverageCell,
  DetectionEvent,
  IndicatorDefinition,
  LayerDefinition,
  LayerId,
  Mission,
  Observation,
  Scenario,
  ScenarioParams,
  SensorValues,
  Waypoint,
} from "./domain";
import { copernicusLayerDefinitions } from "./copernicus";

const GENERATOR_VERSION = "athene-mockgen-0.2.0";
const SCENARIO_VERSION = "scenario-0.1";

export const layerDefinitions: LayerDefinition[] = [
  { id: "temperature", name: "Temperatur", level: "L0", unit: "°C", min: 16, max: 38, palette: ["#2f80ed", "#f2c94c", "#eb5757"] },
  { id: "humidity", name: "Luftfeuchte", level: "L0", unit: "%", min: 28, max: 86, palette: ["#d97706", "#14b8a6", "#0f766e"] },
  { id: "co2", name: "CO2", level: "L0", unit: "ppm", min: 390, max: 560, palette: ["#86efac", "#22c55e", "#166534"] },
  { id: "voc", name: "VOC", level: "L0", unit: "index", min: 70, max: 260, palette: ["#d9f99d", "#f59e0b", "#b45309"] },
  { id: "pm25", name: "PM2.5", level: "L0", unit: "µg/m³", min: 2, max: 42, palette: ["#bae6fd", "#38bdf8", "#7c3aed"] },
  { id: "luxCanopy", name: "Kronenlicht", level: "L3", unit: "lx", min: 1200, max: 62000, palette: ["#14532d", "#eab308", "#f97316"] },
  { id: "dryStress", name: "Trockenstress", level: "L4", unit: "score", min: 0, max: 1, palette: ["#10b981", "#f59e0b", "#dc2626"] },
  { id: "confidence", name: "Observation Confidence", level: "L4", unit: "score", min: 0, max: 1, palette: ["#6b7280", "#60a5fa", "#2563eb"] },
  ...copernicusLayerDefinitions,
];

export const dryStressIndicator: IndicatorDefinition = {
  id: "dry-stress-internal",
  name: "Interner mikroklimatischer Trockenstressindex",
  version: "0.1.0",
  inputs: ["temperature", "humidity"],
  description: "Screeningindex aus normalisierter Temperatur und inverser relativer Luftfeuchte; kein meteorologischer Dürreindex.",
};

export const defaultScenarioParams: ScenarioParams = {
  forestType: "Mischwald",
  season: "Sommer",
  drought: 0.62,
  pollution: 0.34,
  pestPressure: 0.28,
  stormDamage: 0.18,
};

export function generateScenario(seed: string, params: ScenarioParams = defaultScenarioParams): Scenario {
  const rng = mulberry32(hashSeed(seed));
  const forestArea = {
    id: "ES-001",
    name: "ES-001 Kommunaler Mischwald",
    hectares: 42,
    authority: "Kommunale Forstverwaltung Esslingen",
    polygon: [
      { lat: 48.7511, lng: 9.264 },
      { lat: 48.7529, lng: 9.2737 },
      { lat: 48.7488, lng: 9.2793 },
      { lat: 48.7434, lng: 9.2768 },
      { lat: 48.7422, lng: 9.2671 },
      { lat: 48.7466, lng: 9.2625 },
    ],
  };

  const waypoints = generateWaypoints(rng);

  return {
    id: "scenario-es-001",
    seed,
    generatorVersion: GENERATOR_VERSION,
    scenarioVersion: SCENARIO_VERSION,
    forestArea,
    forestPath: {
      id: "forest-path-es-001-main",
      name: "Südhang-Route",
      waypoints,
      driveability: "moderate",
      widthMeters: 2.6,
    },
    forestType: params.forestType,
    season: params.season,
    weather: {
      temperatureMin: 21 + params.drought * 3,
      temperatureMax: 27 + params.drought * 9,
      humidity: 68 - params.drought * 24,
      cloudCover: 0.18 + rng() * 0.16,
      precipitationHistory: params.drought > 0.66 ? "trocken" : params.drought > 0.35 ? "normal" : "feucht",
    },
    stress: {
      drought: params.drought,
      pollution: params.pollution,
      pestPressure: params.pestPressure,
      disturbance: clamp01(0.18 + rng() * 0.18 + params.stormDamage * 0.28),
      stormDamage: params.stormDamage,
    },
  };
}

export function generateMission(scenario: Scenario): Mission {
  return {
    id: "mission-athene-es-001-202607",
    vehicle: "Artemis UGV-02",
    startsAt: "2026-07-16T13:00:00.000Z",
    durationMinutes: 75,
    path: scenario.forestPath,
    dataOrigin: "synthetic",
    seed: scenario.seed,
  };
}

export function generateObservations(mission: Mission, scenario: Scenario): Observation[] {
  const rng = mulberry32(hashSeed(`${scenario.seed}:observations`));
  const start = new Date(mission.startsAt);
  return mission.path.waypoints.map((waypoint, index) => {
    const progress = index / (mission.path.waypoints.length - 1);
    const southSlope = Math.max(0, Math.sin(progress * Math.PI * 1.25));
    const stormPulse = Math.max(0, Math.sin((progress - 0.28) * Math.PI * 3.2)) * scenario.stress.stormDamage;
    const canopyBreak = Math.max(0, Math.sin(progress * Math.PI * 4.1 + 0.6)) * (1 + stormPulse * 0.55);
    const localDryness = clamp01(scenario.stress.drought * 0.62 + southSlope * 0.22 + canopyBreak * 0.1 + stormPulse * 0.18);
    const temperature = scenario.weather.temperatureMin + (scenario.weather.temperatureMax - scenario.weather.temperatureMin) * localDryness + noise(rng, 0.7);
    const humidity = scenario.weather.humidity - localDryness * 18 + noise(rng, 2.8);
    const pressure = 1009 + Math.cos(progress * Math.PI * 2) * 2.2 + noise(rng, 0.5);
    const co2 = 410 + scenario.stress.disturbance * 42 + canopyBreak * 28 + noise(rng, 8);
    const voc = 88 + scenario.stress.pollution * 112 + canopyBreak * 38 + noise(rng, 9);
    const pm25 = 5 + scenario.stress.pollution * 18 + southSlope * 6 + noise(rng, 1.4);
    const luxCanopy = 9000 + canopyBreak * 42000 + (1 - scenario.weather.cloudCover) * 7000 + noise(rng, 1600);
    const luxGround = luxCanopy * (0.23 + canopyBreak * 0.38) + noise(rng, 650);
    const values: SensorValues = {
      temperature: round(temperature, 1),
      humidity: round(clamp(humidity, 22, 86), 1),
      pressure: round(pressure, 1),
      co2: Math.round(co2),
      voc: Math.round(voc),
      pm1: round(Math.max(1, pm25 * 0.55 + noise(rng, 0.5)), 1),
      pm25: round(Math.max(2, pm25), 1),
      pm10: round(Math.max(4, pm25 * 1.9 + noise(rng, 2.1)), 1),
      luxGround: Math.round(Math.max(600, luxGround)),
      luxCanopy: Math.round(Math.max(1200, luxCanopy)),
      dryStress: 0,
    };
    values.dryStress = calculateDryStressIndex(values.temperature, values.humidity, scenario);

    return {
      id: `obs-${String(index + 1).padStart(3, "0")}`,
      missionId: mission.id,
      waypointId: waypoint.id,
      lat: waypoint.lat,
      lng: waypoint.lng,
      timestamp: new Date(start.getTime() + waypoint.minute * 60_000).toISOString(),
      minute: waypoint.minute,
      values,
      detections: generateDetections(rng, values, scenario, stormPulse),
      dataOrigin: "synthetic",
      dataStatus: "simulated",
      confidence: round(clamp01(0.92 - progress * 0.06 - rng() * 0.08), 2),
      source: "Athene Mock Generator",
      generatorVersion: scenario.generatorVersion,
    };
  });
}

export function generateCoverageLayer(observations: Observation[], layer: LayerDefinition): CoverageCell[] {
  const cells: CoverageCell[] = [];
  const offsets = [
    { meters: 0, side: 0 },
    { meters: 14, side: -1 },
    { meters: 14, side: 1 },
    { meters: 28, side: -1 },
    { meters: 28, side: 1 },
  ];

  observations.forEach((observation, index) => {
    if (index % 2 !== 0) return;
    const bearing = index < observations.length - 1 ? bearingBetween(observation, observations[index + 1]) : bearingBetween(observations[index - 1], observation);
    offsets.forEach((offset) => {
      const bearingOffset = bearing + offset.side * 90;
      const point = offset.side === 0 ? observation : destinationPoint(observation, offset.meters, bearingOffset);
      const distanceFactor = offset.meters / 30;
      const confidence = round(clamp01(observation.confidence * (1 - distanceFactor * 0.48)), 2);
      cells.push({
        id: `${layer.id}-${observation.id}-${offset.side}-${offset.meters}`,
        layerId: layer.id,
        lat: point.lat,
        lng: point.lng,
        value: getLayerValue(observation, layer.id),
        unit: layer.unit,
        dataOrigin: "synthetic",
        dataStatus: offset.meters === 0 ? observation.dataStatus : "interpolated",
        confidence,
        distanceToRouteMeters: offset.meters,
        timestamp: observation.timestamp,
        sourceObservationId: observation.id,
      });
    });
  });

  return cells;
}

export function generateRasterCoverageLayer(observations: Observation[], layer: LayerDefinition, polygon: { lat: number; lng: number }[]): CoverageCell[] {
  if (observations.length === 0 || polygon.length === 0) return [];
  const sampleStepMeters = 8;
  const lateralOffsetsMeters = [-8, -4, 0, 4, 8];
  const cells: CoverageCell[] = [];

  for (let index = 0; index < observations.length - 1; index += 1) {
    const start = observations[index];
    const end = observations[index + 1];
    const segmentLength = distanceMeters(start, end);
    const segmentSamples = Math.max(1, Math.ceil(segmentLength / sampleStepMeters));
    const bearing = bearingBetween(start, end);

    for (let sampleIndex = 0; sampleIndex < segmentSamples; sampleIndex += 1) {
      const t = sampleIndex / segmentSamples;
      const basePoint = interpolateCoordinate(start, end, t);
      lateralOffsetsMeters.forEach((offsetMeters) => {
        const center = offsetMeters === 0 ? basePoint : destinationPoint(basePoint, Math.abs(offsetMeters), bearing + (offsetMeters < 0 ? -90 : 90));
        if (!pointInPolygon(center, polygon)) return;
        const distanceFactor = Math.abs(offsetMeters) / 10;
        const interpolatedValue = lerp(getLayerValue(start, layer.id), getLayerValue(end, layer.id), t);
        const interpolatedConfidence = lerp(start.confidence, end.confidence, t);
        const confidence = round(clamp01(interpolatedConfidence * (1 - distanceFactor * 0.28)), 2);

        cells.push({
          id: `${layer.id}-corridor-${index}-${sampleIndex}-${offsetMeters}`,
          layerId: layer.id,
          lat: center.lat,
          lng: center.lng,
          value: round(interpolatedValue, layer.id === "co2" || layer.id === "voc" || layer.id === "luxCanopy" ? 0 : 2),
          unit: layer.unit,
          dataOrigin: "synthetic",
          dataStatus: offsetMeters === 0 ? start.dataStatus : "interpolated",
          confidence,
          distanceToRouteMeters: Math.abs(offsetMeters),
          timestamp: t < 0.5 ? start.timestamp : end.timestamp,
          sourceObservationId: t < 0.5 ? start.id : end.id,
        });
      });
    }
  }

  return cells;
}

export function getLayerValue(observation: Observation, layerId: LayerId): number {
  if (layerId === "confidence") return observation.confidence;
  if (layerId === "copernicusNdvi" || layerId === "copernicusNdmi" || layerId === "copernicusNbr") return 0;
  return observation.values[layerId];
}

export function getLayerDefinition(layerId: LayerId): LayerDefinition {
  return layerDefinitions.find((layer) => layer.id === layerId) ?? layerDefinitions[0];
}

export function colorForValue(value: number | null, layer: LayerDefinition, confidence = 1): string {
  if (value === null) return "#3f3f46";
  const t = clamp01((value - layer.min) / (layer.max - layer.min));
  const [low, mid, high] = layer.palette;
  const mixed = t < 0.5 ? mixHex(low, mid, t * 2) : mixHex(mid, high, (t - 0.5) * 2);
  return confidence < 0.42 ? mixHex("#71717a", mixed, confidence + 0.12) : mixed;
}

export function formatValue(value: number, layer: LayerDefinition): string {
  if (layer.id === "confidence" || layer.id === "dryStress") return value.toFixed(2);
  if (layer.id === "temperature" || layer.id === "humidity" || layer.id === "pm25") return value.toFixed(1);
  return Math.round(value).toString();
}

function generateWaypoints(rng: () => number): Waypoint[] {
  const anchors = [
    { lat: 48.7445, lng: 9.266 },
    { lat: 48.7453, lng: 9.2687 },
    { lat: 48.7468, lng: 9.2702 },
    { lat: 48.7489, lng: 9.2694 },
    { lat: 48.7508, lng: 9.2715 },
    { lat: 48.7497, lng: 9.2753 },
    { lat: 48.7471, lng: 9.2764 },
    { lat: 48.7442, lng: 9.2746 },
  ];
  const waypoints: Waypoint[] = [];
  const count = 126;

  for (let i = 0; i < count; i += 1) {
    const scaled = (i / (count - 1)) * (anchors.length - 1);
    const anchorIndex = Math.min(anchors.length - 2, Math.floor(scaled));
    const localT = scaled - anchorIndex;
    const start = anchors[anchorIndex];
    const end = anchors[anchorIndex + 1];
    const curve = Math.sin(localT * Math.PI) * 0.00055;
    const lat = lerp(start.lat, end.lat, localT) + curve * Math.cos(anchorIndex * 1.4) + noise(rng, 0.00006);
    const lng = lerp(start.lng, end.lng, localT) + curve * Math.sin(anchorIndex * 1.7) + noise(rng, 0.00006);
    waypoints.push({
      id: `wp-${String(i + 1).padStart(3, "0")}`,
      sequence: i + 1,
      minute: round((i / (count - 1)) * 75, 2),
      speedKmh: round(2.4 + rng() * 1.8, 1),
      lat,
      lng,
    });
  }

  return waypoints;
}

function calculateDryStressIndex(temperature: number, humidity: number, scenario: Scenario): number {
  const temperatureScore = clamp01((temperature - scenario.weather.temperatureMin) / (scenario.weather.temperatureMax - scenario.weather.temperatureMin + 0.1));
  const humidityScore = clamp01((72 - humidity) / 48);
  return round(clamp01(temperatureScore * 0.56 + humidityScore * 0.36 + scenario.stress.drought * 0.08), 2);
}

function generateDetections(rng: () => number, values: SensorValues, scenario: Scenario, stormPulse: number): DetectionEvent[] {
  const detections: DetectionEvent[] = [];
  if (rng() > 0.62) detections.push({ type: "tree", label: scenario.forestType === "Nadelwald" ? "Fichte" : "Buche / Eiche", confidence: round(0.72 + rng() * 0.2, 2) });
  if (values.dryStress > 0.68 && rng() > 0.55) detections.push({ type: "damage", label: "sichtbarer Trockenstress", confidence: round(0.64 + rng() * 0.18, 2) });
  if (stormPulse > 0.12 && rng() > 0.44) detections.push({ type: "damage", label: "Sturmschaden / Kronenbruch", confidence: round(0.62 + stormPulse * 0.28 + rng() * 0.1, 2) });
  if (scenario.stress.pestPressure > 0.52 && rng() > 0.78) detections.push({ type: "damage", label: "möglicher Schädlingsbefall", confidence: round(0.58 + rng() * 0.18, 2) });
  if (rng() > 0.72) detections.push({ type: "bird", label: rng() > 0.5 ? "Amsel" : "Buntspecht", confidence: round(0.61 + rng() * 0.24, 2) });
  return detections;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(rng: () => number, amplitude: number): number {
  return (rng() - 0.5) * amplitude * 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateCoordinate(a: { lat: number; lng: number }, b: { lat: number; lng: number }, t: number): { lat: number; lng: number } {
  return {
    lat: lerp(a.lat, b.lat, t),
    lng: lerp(a.lng, b.lng, t),
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function bearingBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const deltaLng = toRad(b.lng - a.lng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function destinationPoint(start: { lat: number; lng: number }, meters: number, bearingDeg: number): { lat: number; lng: number } {
  const radius = 6_371_000;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(start.lat);
  const lng1 = toRad(start.lng);
  const angular = meters / radius;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDeg(lat2), lng: toDeg(lng2) };
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radius = 6_371_000;
  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function pointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = a.lng > point.lng !== b.lng > point.lng && point.lat < ((b.lat - a.lat) * (point.lng - a.lng)) / (b.lng - a.lng) + a.lat;
    if (intersects) inside = !inside;
  }
  return inside;
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function toDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((channel, index) => Math.round(lerp(channel, cb[index], clamp01(t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}
