import { CoverageCell, LayerDefinition, LayerId, Scenario } from "./domain";

export interface CopernicusConfig {
  clientId?: string;
  clientSecret?: string;
  catalogUrl: string;
  processUrl: string;
  enabled: boolean;
}

export interface CopernicusScene {
  id: string;
  date: string;
  collection: "Sentinel-2 L2A";
  cloudCover: number;
  source: string;
}

export interface CopernicusAnalysis {
  scene: CopernicusScene;
  ndviMean: number;
  ndmiMean: number;
  nbrMean: number;
  vegetationLabel: string;
  moistureLabel: string;
  disturbanceLabel: string;
  confidence: number;
  cells: CoverageCell[];
}

export const copernicusLayerDefinitions: LayerDefinition[] = [
  {
    id: "copernicusNdvi",
    name: "Copernicus NDVI",
    level: "L4",
    unit: "index",
    min: 0,
    max: 1,
    palette: ["#a16207", "#84cc16", "#166534"],
  },
  {
    id: "copernicusNdmi",
    name: "Copernicus NDMI",
    level: "L4",
    unit: "index",
    min: -0.4,
    max: 0.7,
    palette: ["#b45309", "#38bdf8", "#1d4ed8"],
  },
  {
    id: "copernicusNbr",
    name: "Copernicus NBR",
    level: "L4",
    unit: "index",
    min: -0.2,
    max: 0.9,
    palette: ["#7f1d1d", "#facc15", "#15803d"],
  },
];

export function getCopernicusConfig(): CopernicusConfig {
  const env = import.meta.env;
  return {
    clientId: env.VITE_COPERNICUS_CLIENT_ID,
    clientSecret: env.VITE_COPERNICUS_CLIENT_SECRET,
    catalogUrl: env.VITE_COPERNICUS_CATALOG_URL ?? "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search",
    processUrl: env.VITE_COPERNICUS_PROCESS_URL ?? "https://sh.dataspace.copernicus.eu/api/v1/process",
    enabled: Boolean(env.VITE_COPERNICUS_CLIENT_ID && env.VITE_COPERNICUS_CLIENT_SECRET),
  };
}

export function buildSentinelHubProcessRequest(scenario: Scenario, from: string, to: string, index: "NDVI" | "NDMI" | "NBR") {
  return {
    input: {
      bounds: {
        geometry: {
          type: "Polygon",
          coordinates: [[...scenario.forestArea.polygon.map((point) => [point.lng, point.lat]), [scenario.forestArea.polygon[0].lng, scenario.forestArea.polygon[0].lat]]],
        },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from,
              to,
            },
            maxCloudCoverage: 35,
          },
        },
      ],
    },
    output: {
      width: 512,
      height: 512,
      responses: [{ identifier: "default", format: { type: "image/tiff" } }],
    },
    evalscript: buildEvalscript(index),
  };
}

export function generateCopernicusDemoAnalysis(scenario: Scenario): CopernicusAnalysis {
  const cells = generateCopernicusCells(scenario);
  const ndviCells = cells.filter((cell) => cell.layerId === "copernicusNdvi" && cell.value != null);
  const ndmiCells = cells.filter((cell) => cell.layerId === "copernicusNdmi" && cell.value != null);
  const nbrCells = cells.filter((cell) => cell.layerId === "copernicusNbr" && cell.value != null);
  const ndviMean = average(ndviCells.map((cell) => cell.value ?? 0));
  const ndmiMean = average(ndmiCells.map((cell) => cell.value ?? 0));
  const nbrMean = average(nbrCells.map((cell) => cell.value ?? 0));
  const cloudCover = Math.round(8 + scenario.stress.drought * 16 + scenario.stress.pollution * 8);
  const confidence = round(Math.max(0.45, 0.86 - cloudCover / 100), 2);

  return {
    scene: {
      id: `S2L2A-${scenario.forestArea.id}-DEMO-20260714`,
      date: "2026-07-14",
      collection: "Sentinel-2 L2A",
      cloudCover,
      source: "Athene synthetischer Sentinel-2-Demofallback",
    },
    ndviMean,
    ndmiMean,
    nbrMean,
    vegetationLabel: ndviMean >= 0.62 ? "vitale Vegetation" : ndviMean >= 0.42 ? "gemischte Vitalität" : "reduzierte Vegetationsvitalität",
    moistureLabel: ndmiMean >= 0.2 ? "ausreichende Vegetationsfeuchte" : ndmiMean >= 0 ? "leichter Feuchtestress" : "deutlicher Feuchtestress",
    disturbanceLabel: nbrMean >= 0.45 ? "keine großflächige Störung" : nbrMean >= 0.25 ? "mögliche strukturelle Auffälligkeit" : "deutlicher Störungsindikator",
    confidence,
    cells,
  };
}

export function getCopernicusLayerCells(analysis: CopernicusAnalysis, layerId: LayerId): CoverageCell[] {
  return analysis.cells.filter((cell) => cell.layerId === layerId);
}

function generateCopernicusCells(scenario: Scenario): CoverageCell[] {
  const lats = scenario.forestArea.polygon.map((point) => point.lat);
  const lngs = scenario.forestArea.polygon.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const cells: CoverageCell[] = [];
  const grid = 11;

  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const lat = minLat + ((maxLat - minLat) * row) / (grid - 1);
      const lng = minLng + ((maxLng - minLng) * col) / (grid - 1);
      const east = col / (grid - 1);
      const south = 1 - row / (grid - 1);
      const canopy = Math.sin(east * Math.PI * 1.8) * 0.08 + Math.cos(south * Math.PI * 2.4) * 0.05;
      const dryness = scenario.stress.drought * 0.34 + south * 0.2 + Math.max(0, east - 0.55) * 0.16;
      const ndvi = round(clamp(0.74 - dryness * 0.42 + canopy, 0.18, 0.86), 2);
      const ndmi = round(clamp(0.32 - dryness * 0.58 + canopy * 0.6, -0.26, 0.48), 2);
      const nbr = round(clamp(0.62 - scenario.stress.disturbance * 0.2 - scenario.stress.stormDamage * 0.18 - dryness * 0.2 + canopy * 0.5, 0.08, 0.78), 2);
      const confidence = round(clamp(0.78 - Math.abs(east - 0.5) * 0.1 - scenario.weather.cloudCover * 0.18, 0.5, 0.86), 2);
      const inside = pointInPolygon({ lat, lng }, scenario.forestArea.polygon);
      const common = {
        lat,
        lng,
        unit: "index",
        dataOrigin: "synthetic" as const,
        dataStatus: (inside ? "modeled" : "unknown") as "modeled" | "unknown",
        confidence: inside ? confidence : 0,
        distanceToRouteMeters: 0,
        timestamp: "2026-07-14T10:15:00.000Z",
        sourceObservationId: "copernicus-sentinel-2-l2a",
        source: "Athene synthetischer Sentinel-2-Demofallback",
        modelVersion: "copernicus-demo-0.1.0",
      };
      cells.push({ ...common, id: `copernicus-ndvi-${row}-${col}`, layerId: "copernicusNdvi", value: inside ? ndvi : null });
      cells.push({ ...common, id: `copernicus-ndmi-${row}-${col}`, layerId: "copernicusNdmi", value: inside ? ndmi : null });
      cells.push({ ...common, id: `copernicus-nbr-${row}-${col}`, layerId: "copernicusNbr", value: inside ? nbr : null });
    }
  }

  return cells;
}

function pointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    const intersects = a.lng > point.lng !== b.lng > point.lng && point.lat < ((b.lat - a.lat) * (point.lng - a.lng)) / (b.lng - a.lng) + a.lat;
    if (intersects) inside = !inside;
  }
  return inside;
}

function buildEvalscript(index: "NDVI" | "NDMI" | "NBR"): string {
  const expression = {
    NDVI: "(B08 - B04) / (B08 + B04)",
    NDMI: "(B08 - B11) / (B08 + B11)",
    NBR: "(B08 - B12) / (B08 + B12)",
  }[index];
  return `//VERSION=3
function setup() {
  return { input: ["B04", "B08", "B11", "B12", "dataMask"], output: { bands: 2, sampleType: "FLOAT32" } };
}
function evaluatePixel(sample) {
  const value = ${expression};
  return [value, sample.dataMask];
}`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
