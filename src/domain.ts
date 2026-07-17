export type DataOrigin = "synthetic" | "real" | "external";
export type DataStatus = "measured" | "simulated" | "derived" | "interpolated" | "modeled" | "unknown";
export type LayerLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";
export type LayerId =
  | "temperature"
  | "humidity"
  | "co2"
  | "voc"
  | "pm25"
  | "luxCanopy"
  | "dryStress"
  | "confidence"
  | "copernicusNdvi"
  | "copernicusNdmi"
  | "copernicusNbr";

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface ForestArea {
  id: string;
  name: string;
  polygon: Coordinate[];
  hectares: number;
  authority: string;
}

export interface Waypoint extends Coordinate {
  id: string;
  sequence: number;
  minute: number;
  speedKmh: number;
}

export interface ForestPath {
  id: string;
  name: string;
  waypoints: Waypoint[];
  driveability: "easy" | "moderate" | "limited";
  widthMeters: number;
}

export interface Scenario {
  id: string;
  seed: string;
  generatorVersion: string;
  scenarioVersion: string;
  forestArea: ForestArea;
  forestPath: ForestPath;
  forestType: "Mischwald" | "Nadelwald" | "Laubwald" | "Aufforstungsfläche";
  season: "Frühjahr" | "Sommer" | "Herbst" | "Winter";
  weather: {
    temperatureMin: number;
    temperatureMax: number;
    humidity: number;
    cloudCover: number;
    precipitationHistory: "trocken" | "normal" | "feucht";
  };
  stress: {
    drought: number;
    pollution: number;
    pestPressure: number;
    disturbance: number;
    stormDamage: number;
  };
}

export interface Mission {
  id: string;
  vehicle: string;
  startsAt: string;
  durationMinutes: number;
  path: ForestPath;
  dataOrigin: DataOrigin;
  seed: string;
}

export interface SensorValues {
  temperature: number;
  humidity: number;
  pressure: number;
  co2: number;
  voc: number;
  pm1: number;
  pm25: number;
  pm10: number;
  luxGround: number;
  luxCanopy: number;
  dryStress: number;
}

export interface Observation extends Coordinate {
  id: string;
  missionId: string;
  waypointId: string;
  timestamp: string;
  minute: number;
  values: SensorValues;
  detections: DetectionEvent[];
  dataOrigin: DataOrigin;
  dataStatus: DataStatus;
  confidence: number;
  source: string;
  generatorVersion: string;
}

export interface DetectionEvent {
  type: "tree" | "damage" | "bird";
  label: string;
  confidence: number;
}

export interface LayerDefinition {
  id: LayerId;
  name: string;
  level: LayerLevel;
  unit: string;
  min: number;
  max: number;
  palette: [string, string, string];
}

export interface CoverageCell extends Coordinate {
  id: string;
  layerId: LayerId;
  value: number | null;
  unit: string;
  dataOrigin: DataOrigin;
  dataStatus: DataStatus;
  confidence: number;
  distanceToRouteMeters: number;
  timestamp: string;
  sourceObservationId: string;
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  version: string;
  inputs: LayerId[];
  description: string;
}

export interface ScenarioParams {
  forestType: Scenario["forestType"];
  season: Scenario["season"];
  drought: number;
  pollution: number;
  pestPressure: number;
  stormDamage: number;
}

export interface SavedPathRecord {
  id: string;
  name: string;
  savedAt: string;
  waypoints: Waypoint[];
}

export interface SavedScenarioRecord {
  id: string;
  name: string;
  savedAt: string;
  seed: string;
  params: ScenarioParams;
  pathName: string;
  waypoints: Waypoint[];
}

export interface ForestDrawingArea {
  id: string;
  name: string;
  scopeId: string;
  scopeName: string;
  polygon: Coordinate[];
  createdAt: string;
}

export interface MissionRecord {
  id: string;
  missionId: string;
  scenarioName: string;
  forestAreaName: string;
  pathName: string;
  createdAt: string;
  seed: string;
  generatorVersion: string;
  summary: string;
  metrics: Record<string, string | number>;
  recommendations: string[];
}
