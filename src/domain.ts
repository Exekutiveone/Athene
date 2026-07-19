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
  /** Starts a new, disconnected route segment. No travel or interpolation crosses this boundary. */
  breakBefore?: boolean;
}

export interface ForestPath {
  id: string;
  name: string;
  waypoints: Waypoint[];
  driveability: "easy" | "moderate" | "limited";
  widthMeters: number;
}

export interface MissionPath {
  name: string;
  /** Canonical geometry. Disconnected route parts remain separate arrays. */
  segments?: Waypoint[][];
  /** Legacy flattened representation retained while older stored records are migrated. */
  waypoints: Waypoint[];
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
  areaId: string;
  municipalityId: string;
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
  routeBreakBefore?: boolean;
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
  source: string;
  modelVersion: string | null;
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

export type ManagementStatus = "aktiv" | "planung" | "review" | "archiviert";

export interface StakeholderRecord {
  id: string;
  municipalityId: string;
  name: string;
  role: string;
  access: "Admin" | "Operator" | "Viewer";
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface MunicipalityRecord {
  id: string;
  name: string;
  type: "Gemeinde" | "Stadt" | "Landkreis";
  region: string;
  population: number;
  center: Coordinate;
  administrativeScopeId?: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/** The one canonical, persisted polygon used by portal, map and GeoID. */
export interface DeploymentArea {
  id: string;
  name: string;
  municipalityId: string | null;
  scopeId: string;
  scopeName: string;
  polygon: Coordinate[];
  hectares: number;
  boundaryStatus: "pending" | "defined";
  focus: string;
  description: string;
  status: ManagementStatus;
  dataOrigin: DataOrigin;
  dataStatus: DataStatus;
  source: string;
  confidence: number | null;
  linkageStatus: "linked" | "review-needed";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/** @deprecated Kept as a source-compatible alias for old persisted records. */
export type ForestDrawingArea = DeploymentArea;

export interface PlannedMissionRecord {
  id: string;
  municipalityId: string;
  areaId: string;
  title: string;
  objective: string;
  requestedAt: string;
  priority: "normal" | "hoch" | "kritisch";
  status: "entwurf" | "geplant" | "bereit" | "processing" | "abgeschlossen";
  seed: string;
  scenarioName: string;
  pathName: string;
  /** undefined = legacy/generated route, null = explicitly no route. */
  missionPath?: MissionPath | null;
  /** Keeps uploaded/real mission planning visibly separate from generated mock scenarios. */
  dataMode?: "real" | "mock";
  /** Timestamp and aggregate derived from this mission's saved route observations. */
  routeSummary?: {
    averageDryStress: number;
    averageConfidence: number;
    observationCount: number;
    calculatedAt: string;
    dataOrigin: "real" | "synthetic";
    dataStatus: "measured" | "derived";
    source: string;
    modelVersion: string | null;
  };
  params: ScenarioParams;
  createdAt: string;
  updatedAt: string;
}

export interface MissionRecord {
  id: string;
  missionId: string;
  areaId: string | null;
  municipalityId: string | null;
  scenarioName: string;
  forestAreaName: string;
  pathName: string;
  createdAt: string;
  missionStartedAt: string | null;
  missionCompletedAt: string | null;
  surveyedAt: string | null;
  seed: string;
  generatorVersion: string;
  summary: string;
  metrics: Record<string, string | number>;
  recommendations: string[];
  dataOrigin: DataOrigin;
  dataStatus: DataStatus;
  confidence: number | null;
  source: string;
  coverageShare: number | null;
  unknownShare: number | null;
  linkageStatus: "linked" | "review-needed";
}
