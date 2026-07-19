import { Fragment, type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, ImageOverlay, MapContainer, Polygon, Polyline, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { canvas as createLeafletCanvas } from "leaflet";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Flame,
  FolderOpen,
  GripVertical,
  Layers,
  MapPinned,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Satellite,
  Save,
  Sprout,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  Users,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Coordinate, CoverageCell, DeploymentArea, ForestArea, ForestPath, LayerId, MissionPath, MissionRecord, MunicipalityRecord, Observation, PlannedMissionRecord, SavedPathRecord, SavedScenarioRecord, ScenarioParams, StakeholderRecord, Waypoint } from "./domain";
import {
  colorForValue,
  defaultScenarioParams,
  dryStressIndicator,
  formatValue,
  generateRasterCoverageLayer,
  generateMission,
  generateObservations,
  generateScenario,
  getLayerDefinition,
  getLayerValue,
  layerDefinitions,
} from "./generator";
import { CopernicusAnalysis, generateCopernicusDemoAnalysis, getCopernicusConfig, getCopernicusLayerCells } from "./copernicus";
import { fetchOsmForestPaths, OsmForestPath, OsmLoadProgress } from "./osmForestPaths";
import {
  deleteMissionRecord,
  deletePlannedMission,
  deletePathRecord,
  deleteScenarioRecord,
  fetchForestAreas,
  fetchMunicipalities,
  fetchMissionRecords,
  fetchPlannedMissions,
  fetchSavedPaths,
  fetchSavedScenarios,
  fetchStakeholders,
  saveForestArea,
  saveMunicipality,
  saveMissionRecord,
  saveMissionBundle,
  savePlannedMission,
  savePathRecord,
  saveScenarioRecord,
  saveStakeholder,
} from "./api";
import { aggregateAreaRecords, calculatePolygonHectares, calculateRouteCoverageShare, hasDefinedMissionPath, ManagementSelection, missionPathWaypoints, normalizeDeploymentArea, resolveManagementSelection, seedDeploymentAreas, seedMunicipalities, seedPlannedMissions, seedStakeholders } from "./management";
import { acknowledgeManagementMutation, enqueueManagementMutation, flushManagementOutbox, ManagementMutation, mergePendingEntities, readManagementOutbox } from "./managementOutbox";
import { buildFallbackWeather, describeWeatherCode, fetchLiveWeather, LiveWeather } from "./weather";
import { RealMissionUploadPage } from "./pages/RealMissionUploadPage";
import { PortalPage } from "./pages/PortalPage";
import { AreaContextPage, RegionalConditionOverview } from "./pages/ForestOverviewPages";
import { PortalRole, usePortalAuthorization } from "./hooks/usePortalAuthorization";
import { FitCoordinateBounds, MapClickCapture } from "./components/MapControllers";
import { useForestHeatmap } from "./hooks/useForestHeatmap";
import { createMissionPath, missionPathSegments, missionPathWaypointsFlat } from "./routeGeometry";
import {
  BiodiversityMetrics,
  calculateBiodiversityMetrics,
  findTaxon,
  generateSpeciesObservations,
  indexDefinitionsDemo,
  IndexDefinitionDemo,
  plantCatalog,
  SpeciesObservationRecord,
  speciesCatalog,
  speciesQualityRules,
} from "./speciesKnowledge";

const initialSeed = "ATHENE-ES001-202607-013";
const savedPathsStorageKey = "athene.savedPaths.v1";
const savedScenariosStorageKey = "athene.savedScenarios.v1";
const forestAreasStorageKey = "athene.forestAreas.v1";
const municipalitiesStorageKey = "athene.municipalities.v2";
const municipalityOrderStorageKey = "athene.municipalityOrder.v1";
const stakeholdersStorageKey = "athene.stakeholders.v2";
const plannedMissionsStorageKey = "athene.plannedMissions.v2";
const customIndexesStorageKey = "athene.customIndexes.v1";
const indexDisplaySettingsStorageKey = "athene.indexDisplaySettings.v1";
const districtGeoJsonUrl = "https://raw.githubusercontent.com/isellsoap/deutschlandGeoJSON/master/4_kreise/4_niedrig.geo.json";
const administrativeWfsUrl = "https://owsproxy.lgl-bw.de/owsproxy/wfs/WFS_LGL-BW_ATKIS_BasisDLM_VerwGr";
const measurementCorridorWidthMeters = 16;
const baseMaps = {
  street: {
    label: "Karte",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  topo: {
    label: "Topo-Karte",
    attribution:
      'Kartendaten: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Darstellung: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  },
  satellite: {
    label: "Satellit",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  },
} as const;

type BaseMapId = keyof typeof baseMaps;

type AppView = "portal" | "geo" | "indexBuilder" | "hyperion" | "adminMap" | "regionalOverview" | "missionUpload";

interface HyperionMapItem {
  id: string;
  municipalityId: string;
  areaName: string;
  type: "tool" | "file" | "layer" | "report";
  title: string;
  description: string;
  owner: string;
  status: "ready" | "draft" | "review";
  updatedAt: string;
  coordinate: Coordinate;
  payload: Array<{ label: string; value: string }>;
}

interface Municipality extends MunicipalityRecord {
  stakeholders: StakeholderRecord[];
  areas: DeploymentArea[];
  missionIds: string[];
}

interface BadenWuerttembergDistrictProperties {
  ID_3: number;
  NAME_1: string;
  NAME_3: string;
  TYPE_3: string;
  ENGTYPE_3: string;
}

interface BadenWuerttembergDistrictFeature {
  type: "Feature";
  properties: BadenWuerttembergDistrictProperties;
  geometry: unknown;
}

interface DistrictFeatureCollection {
  type: "FeatureCollection";
  features: BadenWuerttembergDistrictFeature[];
}

interface GemeindeProperties {
  gemeinde_id: string;
  gemeinde_name: string;
  gemeinde_name_lang: string;
  gemeinde_art: string;
  kreis_name: string;
  einwohner_zensus: number | null;
}

interface GemeindeFeature {
  type: "Feature";
  properties: GemeindeProperties;
  geometry: unknown;
}

interface GemeindeFeatureCollection {
  type: "FeatureCollection";
  features: GemeindeFeature[];
}

interface CustomerMissionTemplate {
  id: string;
  municipalityId: string;
  areaId: string;
  areaName: string;
  customer: string;
  title: string;
  requestedAt: string;
  priority: "normal" | "hoch" | "kritisch";
  objective: string;
  seed: string;
  scenarioName: string;
  pathName: string;
  missionPath?: MissionPath | null;
  dataMode?: "real" | "mock";
  routeSummary?: PlannedMissionRecord["routeSummary"];
  params: ScenarioParams;
}

interface MissionOverview {
  drynessLabel: string;
  drynessTone: "good" | "watch" | "risk";
  averageDryStress: number;
  maxDryStress: number;
  dryHotspots: number;
  averageTemperature: number;
  maxTemperature: number;
  averageHumidity: number;
  minHumidity: number;
  averageConfidence: number;
  lowConfidenceShare: number;
  unknownShare: number;
  airLoadLabel: string;
  airLoadScore: number;
  canopyLabel: string;
  averageLuxCanopy: number;
  treeDetections: Array<{ label: string; count: number }>;
  damageDetections: Array<{ label: string; count: number }>;
  birdDetections: Array<{ label: string; count: number }>;
  generatedSummary: string;
  recommendations: string[];
}

interface IndexBuilderValues {
  temperature: number;
  humidity: number;
  dryStress: number;
  confidence: number;
  speciesRichness: number;
  shannon: number;
  acousticActivityRate: number;
  nativePlantShare: number;
  ndvi: number;
  ndmi: number;
  nbr: number;
  climateWeight: number;
  biodiversityWeight: number;
  satelliteWeight: number;
}

interface CustomIndexDefinition extends IndexDefinitionDemo {
  createdAt: string;
  selectedInputIds: string[];
}

interface IndexDisplaySetting {
  indexCode: string;
  visible: boolean;
  favorite: boolean;
  channel: "Admin" | "Partner" | "Bürger";
  displayMode: "Kachel" | "Kompakt" | "Detail";
}

type ManagementFormData =
  | { kind: "municipality"; name: string; type: MunicipalityRecord["type"]; region: string; population: number; center: Coordinate }
  | { kind: "stakeholder"; name: string; role: string; access: StakeholderRecord["access"] }
  | { kind: "area"; name: string; focus: string; description: string; status: DeploymentArea["status"] }
  | { kind: "mission"; areaId: string; title: string; objective: string; priority: PlannedMissionRecord["priority"]; requestedAt: string };

const copernicusLayerIds: LayerId[] = ["copernicusNdvi", "copernicusNdmi", "copernicusNbr"];
const hyperionItems: HyperionMapItem[] = [
  {
    id: "hyp-ess-layer-dryness",
    municipalityId: "mun-esslingen",
    areaName: "Südhang ES-001",
    type: "layer",
    title: "Trockenstress Raster",
    description: "Interpolierter Master-Map-Layer für mikroklimatischen Trockenstress und unbekannte Zonen.",
    owner: "Forstverwaltung Esslingen",
    status: "ready",
    updatedAt: "2026-07-16T11:40:00.000Z",
    coordinate: { lat: 48.7476, lng: 9.2704 },
    payload: [
      { label: "Layer", value: "dryStress" },
      { label: "Aufloesung", value: "18 x 18 Raster" },
      { label: "Status", value: "synthetic / interpolated" },
    ],
  },
  {
    id: "hyp-ess-tool-fire",
    municipalityId: "mun-esslingen",
    areaName: "Südhang ES-001",
    type: "tool",
    title: "Waldbrand Screening Tool",
    description: "Kombiniert Trockenstress, Live-Wetter, Confidence und Messluecken als Screening-Hinweis.",
    owner: "Amt für Umwelt",
    status: "review",
    updatedAt: "2026-07-16T12:05:00.000Z",
    coordinate: { lat: 48.7463, lng: 9.2731 },
    payload: [
      { label: "Index", value: "DRYNESS_STRESS_V1" },
      { label: "Freigabe", value: "EXPERIMENTAL" },
      { label: "Grenze", value: "kein Alarmgeber" },
    ],
  },
  {
    id: "hyp-ess-file-briefing",
    municipalityId: "mun-esslingen",
    areaName: "Buergerwald Nord",
    type: "file",
    title: "Stakeholder Briefing",
    description: "Interner Lagezettel für Forst, Feuerwehr und Umweltamt.",
    owner: "Forstverwaltung Esslingen",
    status: "draft",
    updatedAt: "2026-07-16T12:20:00.000Z",
    coordinate: { lat: 48.7494, lng: 9.2686 },
    payload: [
      { label: "Dateityp", value: "PDF / DOCX" },
      { label: "Sichtbarkeit", value: "intern" },
      { label: "Version", value: "0.2" },
    ],
  },
  {
    id: "hyp-rem-report-storm",
    municipalityId: "mun-remstal",
    areaName: "Sturmpruefung Hauptweg",
    type: "report",
    title: "Sturmschaden Record",
    description: "Mission Record mit Kronenbruch, Wegestatus und NBR-Kontext.",
    owner: "Kommunaler Krisenstab Remstal",
    status: "ready",
    updatedAt: "2026-07-16T13:10:00.000Z",
    coordinate: { lat: 48.8048, lng: 9.4212 },
    payload: [
      { label: "Mission", value: "Sturmschaden-Nachkontrolle" },
      { label: "Quelle", value: "UGV + Sentinel-2" },
      { label: "Review", value: "Operator offen" },
    ],
  },
  {
    id: "hyp-rem-tool-route",
    municipalityId: "mun-remstal",
    areaName: "Hangwald West",
    type: "tool",
    title: "Befahrbarkeitsprüfung",
    description: "Werkzeug zur Sichtung von Wegpunkten, Barrieren und Folgefahrten.",
    owner: "Bauhof Verbund",
    status: "review",
    updatedAt: "2026-07-16T13:22:00.000Z",
    coordinate: { lat: 48.8029, lng: 9.4178 },
    payload: [
      { label: "Routing", value: "manual waypoints" },
      { label: "Naechster Schritt", value: "Folgemission planen" },
      { label: "Sichtbarkeit", value: "Operator" },
    ],
  },
  {
    id: "hyp-neck-layer-species",
    municipalityId: "mun-neckartal",
    areaName: "Jungbestand Baseline",
    type: "layer",
    title: "Artenlayer Baseline",
    description: "Taxon-Kandidaten, Richness und Native Plant Share für die Aufforstungsfläche.",
    owner: "Aufforstungsprojekt Neckartal",
    status: "ready",
    updatedAt: "2026-07-16T14:00:00.000Z",
    coordinate: { lat: 48.7228, lng: 9.2142 },
    payload: [
      { label: "Taxa", value: "Starterkatalog 32" },
      { label: "Index", value: "VEGETATION_DIVERSITY_V1" },
      { label: "Review", value: "Domain Reviewer" },
    ],
  },
  {
    id: "hyp-neck-file-public",
    municipalityId: "mun-neckartal",
    areaName: "Pufferflaeche Bachlauf",
    type: "file",
    title: "Buergerfreigabe Vorschau",
    description: "Reduzierte Anzeige für öffentliche Informationen ohne sensible Taxa.",
    owner: "Buergerdialog Wald",
    status: "draft",
    updatedAt: "2026-07-16T14:18:00.000Z",
    coordinate: { lat: 48.7214, lng: 9.2174 },
    payload: [
      { label: "Kanal", value: "Buergeransicht" },
      { label: "Sensitive Arten", value: "vergroessert / verborgen" },
      { label: "Status", value: "Entwurf" },
    ],
  },
];

export function App() {
  const importScenarioInputRef = useRef<HTMLInputElement | null>(null);
  const [appView, setAppView] = useState<AppView>("portal");
  const [seed, setSeed] = useState(initialSeed);
  const [params, setParams] = useState<ScenarioParams>(defaultScenarioParams);
  const [scenarioName, setScenarioName] = useState("Szenario Esslingen");
  const [activeLayerId, setActiveLayerId] = useState<LayerId>("dryStress");
  const [layerOpacity, setLayerOpacity] = useState(0.72);
  const [baseMapId, setBaseMapId] = useState<BaseMapId>("street");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCell, setSelectedCell] = useState<CoverageCell | null>(null);
  const [isMissionOverviewOpen, setIsMissionOverviewOpen] = useState(false);
  const [draftPathName, setDraftPathName] = useState("Manuell erfasster Weg");
  const [draftWaypoints, setDraftWaypoints] = useState<Waypoint[]>([]);
  const [manualLat, setManualLat] = useState("48.7468");
  const [manualLng, setManualLng] = useState("9.2702");
  const [isPathCaptureEnabled, setIsPathCaptureEnabled] = useState(false);
  const [savedPaths, setSavedPaths] = useState<SavedPathRecord[]>(readSavedPaths);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioRecord[]>(readSavedScenarios);
  const [customIndexes, setCustomIndexes] = useState<CustomIndexDefinition[]>(readCustomIndexes);
  const [indexDisplaySettings, setIndexDisplaySettings] = useState<IndexDisplaySetting[]>(readIndexDisplaySettings);
  const [missionRecords, setMissionRecords] = useState<MissionRecord[]>([]);
  const [managedMunicipalities, setManagedMunicipalities] = useState<MunicipalityRecord[]>(readManagedMunicipalities);
  const [municipalityOrder, setMunicipalityOrder] = useState<string[]>(readMunicipalityOrder);
  const [deploymentAreas, setDeploymentAreas] = useState<DeploymentArea[]>(readDeploymentAreas);
  const [managedStakeholders, setManagedStakeholders] = useState<StakeholderRecord[]>(readManagedStakeholders);
  const [plannedMissions, setPlannedMissions] = useState<PlannedMissionRecord[]>(readPlannedMissions);
  const [managementSelection, setManagementSelection] = useState<ManagementSelection>({ municipalityId: "mun-esslingen", areaId: "area-ess-south", missionId: "cust-esslingen-20260716-fire" });
  const [mapFocusAreaId, setMapFocusAreaId] = useState<string | null>(null);
  const [mapFocusMunicipalityId, setMapFocusMunicipalityId] = useState<string | null>(null);
  const [missionUploadContext, setMissionUploadContext] = useState<{ areaId: string; route: Coordinate[] } | null>(null);
  const [mapDetailAreaId, setMapDetailAreaId] = useState<string | null>(null);
  const [geoParentView, setGeoParentView] = useState<"portal" | "adminMap">("portal");
  const [geoContextMode, setGeoContextMode] = useState<"area" | "mission">("mission");
  const [managementDialog, setManagementDialog] = useState<"municipality" | "stakeholder" | "area" | "mission" | null>(null);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingMunicipalityId, setEditingMunicipalityId] = useState<string | null>(null);
  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(() => readManagementOutbox().length);
  const [managementFeedback, setManagementFeedback] = useState<{ tone: "success" | "error" | "loading"; message: string } | null>(null);
  const { role: portalRole, isAdmin, changeRole: changePortalRole } = usePortalAuthorization(setManagementFeedback);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [customerMissionStatus, setCustomerMissionStatus] = useState<"eingang" | "geladen" | "processing" | "bereit">("eingang");
  const [liveWeather, setLiveWeather] = useState<LiveWeather>(() => buildFallbackWeather(seedMunicipalities[0].center));
  const [weatherStatus, setWeatherStatus] = useState<"loading" | "live" | "fallback">("fallback");
  const [geoOsmForestPaths, setGeoOsmForestPaths] = useState<OsmForestPath[]>([]);
  const [geoOsmPathState, setGeoOsmPathState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [geoOsmPathProgress, setGeoOsmPathProgress] = useState(0);
  const [geoOsmPathStatus, setGeoOsmPathStatus] = useState<OsmLoadProgress | null>(null);
  const [geoOsmReloadKey, setGeoOsmReloadKey] = useState(0);
  const [geoSelectedOsmPathIds, setGeoSelectedOsmPathIds] = useState<number[]>([]);
  const [geoOsmBaseRoute, setGeoOsmBaseRoute] = useState<Waypoint[]>([]);
  const [geoHoveredOsmPathId, setGeoHoveredOsmPathId] = useState<number | null>(null);
  const [forestDataDisplayMode, setForestDataDisplayMode] = useState<"corridor" | "surface" | "average">("corridor");
  const [heatmapInterpolationMode, setHeatmapInterpolationMode] = useState<"full" | "confidence">("full");
  const [heatmapMaxDistanceMeters, setHeatmapMaxDistanceMeters] = useState(30);
  const [heatmapMinConfidence, setHeatmapMinConfidence] = useState(0.45);
  const [missionSaveState, setMissionSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const geoOsmPathRenderer = useMemo(() => createLeafletCanvas({ padding: 0.5, tolerance: 12 }), []);

  useEffect(() => {
    if (isAdmin) return;
    setIsPathCaptureEnabled(false);
    setGeoSelectedOsmPathIds([]);
    setGeoOsmBaseRoute([]);
  }, [isAdmin]);

  const portalMunicipalities = useMemo<Municipality[]>(() => {
    const orderIndex = new Map(municipalityOrder.map((id, index) => [id, index]));
    return managedMunicipalities
      .filter((municipality) => municipality.status !== "archived")
      .map((municipality) => ({
        ...municipality,
        stakeholders: managedStakeholders.filter((stakeholder) => stakeholder.municipalityId === municipality.id && stakeholder.status !== "archived"),
        areas: deploymentAreas.filter((area) => area.municipalityId === municipality.id && area.status !== "archiviert"),
        missionIds: plannedMissions.filter((missionItem) => missionItem.municipalityId === municipality.id && missionItem.status !== "archiviert").map((missionItem) => missionItem.id),
      }))
      .sort((a, b) => (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [deploymentAreas, managedMunicipalities, managedStakeholders, municipalityOrder, plannedMissions]);
  const portalMissions = useMemo<CustomerMissionTemplate[]>(() => plannedMissions.filter((missionItem) => missionItem.status !== "archiviert").map((missionItem) => {
    const areaItem = deploymentAreas.find((area) => area.id === missionItem.areaId);
    const owner = managedStakeholders.find((stakeholder) => stakeholder.municipalityId === missionItem.municipalityId);
    return { ...missionItem, areaName: areaItem?.name ?? "Unbekanntes Einsatzgebiet", customer: owner?.name ?? "Kommunale Verwaltung" };
  }), [deploymentAreas, managedStakeholders, plannedMissions]);
  const selectionCollections = useMemo(() => ({ municipalities: managedMunicipalities, areas: deploymentAreas, missions: plannedMissions }), [deploymentAreas, managedMunicipalities, plannedMissions]);
  const selectManagementContext = (requested: Partial<ManagementSelection>) => setManagementSelection(resolveManagementSelection(selectionCollections, requested));
  const reorderMunicipalities = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const activeIds = portalMunicipalities.map((municipality) => municipality.id);
    const fromIndex = activeIds.indexOf(draggedId);
    const targetIndex = activeIds.indexOf(targetId);
    if (fromIndex < 0 || targetIndex < 0) return;
    const next = [...activeIds];
    const [dragged] = next.splice(fromIndex, 1);
    next.splice(targetIndex, 0, dragged);
    setMunicipalityOrder(next);
    window.localStorage.setItem(municipalityOrderStorageKey, JSON.stringify(next));
  };
  const selectedMunicipalityId = managementSelection.municipalityId;
  const selectedAreaId = managementSelection.areaId;
  const selectedCustomerMissionId = managementSelection.missionId;
  const selectedMunicipality = portalMunicipalities.find((item) => item.id === selectedMunicipalityId) ?? null;
  const selectedArea = deploymentAreas.find((area) => area.id === selectedAreaId && area.municipalityId === selectedMunicipalityId && area.status !== "archiviert") ?? null;
  const selectedCustomerMission = portalMissions.find((item) => item.id === selectedCustomerMissionId && item.areaId === selectedAreaId && item.municipalityId === selectedMunicipalityId) ?? null;
  const hasActiveMissionPath = draftWaypoints.length >= 2;
  const allIndexDefinitions = useMemo<IndexDefinitionDemo[]>(() => [...customIndexes, ...indexDefinitionsDemo], [customIndexes]);
  const displayedIndexDefinitions = useMemo(
    () =>
      allIndexDefinitions
        .filter((definition) => getIndexDisplaySetting(indexDisplaySettings, definition.indexCode).visible)
        .sort((a, b) => Number(getIndexDisplaySetting(indexDisplaySettings, b.indexCode).favorite) - Number(getIndexDisplaySetting(indexDisplaySettings, a.indexCode).favorite)),
    [allIndexDefinitions, indexDisplaySettings],
  );
  const scenario = useMemo(() => generateScenario(seed, params), [seed, params]);
  const canonicalForestArea = useMemo<ForestArea>(() => selectedArea ? ({
    id: selectedArea.id,
    name: selectedArea.name,
    polygon: selectedArea.polygon,
    hectares: selectedArea.hectares,
    authority: selectedMunicipality?.name ?? selectedArea.scopeName,
  }) : scenario.forestArea, [scenario.forestArea, selectedArea, selectedMunicipality?.name]);
  const activeForestPath = useMemo(
    () => (draftWaypoints.length >= 2 ? buildForestPath(draftWaypoints, draftPathName) : fitForestPathToArea(scenario.forestPath, canonicalForestArea)),
    [canonicalForestArea, draftPathName, draftWaypoints, scenario.forestPath],
  );
  const activeForestArea = canonicalForestArea;
  const activeRouteLengthMeters = useMemo(() => calculateRouteLengthMeters(activeForestPath.waypoints), [activeForestPath.waypoints]);
  const activeMeasurementCorridorHectares = Math.max(0, round((activeRouteLengthMeters * measurementCorridorWidthMeters) / 10_000, 2));
  const activeScenario = useMemo(() => ({ ...scenario, forestArea: activeForestArea, forestPath: activeForestPath }), [activeForestArea, activeForestPath, scenario]);
  const mission = useMemo(() => generateMission(activeScenario, { areaId: selectedArea?.id, municipalityId: selectedMunicipality?.id }), [activeScenario, selectedArea?.id, selectedMunicipality?.id]);
  const generatedObservations = useMemo(() => generateObservations(mission, activeScenario), [mission, activeScenario]);
  const persistedMissionResult = useMemo(() => selectedCustomerMission
    ? missionRecords
      .filter((record) => record.missionId === selectedCustomerMission.id && record.observations?.length)
      .sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt))[0] ?? null
    : null, [missionRecords, selectedCustomerMission]);
  const persistedResultMatchesDraft = useMemo(() => Boolean(persistedMissionResult?.scenarioParams && persistedMissionResult.missionPath
    && JSON.stringify(persistedMissionResult.scenarioParams) === JSON.stringify(params)
    && routeCoordinatesEqual(missionPathWaypointsFlat(persistedMissionResult.missionPath), draftWaypoints)), [draftWaypoints, params, persistedMissionResult]);
  const observations = useMemo(() => persistedResultMatchesDraft && persistedMissionResult?.observations?.length
    ? persistedMissionResult.observations
    : generatedObservations, [generatedObservations, persistedMissionResult, persistedResultMatchesDraft]);
  const speciesObservations = useMemo(() => generateSpeciesObservations(observations), [observations]);
  const biodiversityMetrics = useMemo(() => calculateBiodiversityMetrics(speciesObservations), [speciesObservations]);
  const activeLayer = getLayerDefinition(activeLayerId);
  const activeBaseMap = baseMaps[baseMapId];
  const copernicusConfig = useMemo(() => getCopernicusConfig(), []);
  const copernicusAnalysis = useMemo(() => generateCopernicusDemoAnalysis(activeScenario), [activeScenario]);
  const isCopernicusLayer = copernicusLayerIds.includes(activeLayerId);
  const corridorCoverage = useMemo(
    () => (isCopernicusLayer ? getCopernicusLayerCells(copernicusAnalysis, activeLayerId) : generateRasterCoverageLayer(observations, activeLayer, activeScenario.forestArea.polygon)),
    [activeLayer, activeLayerId, activeScenario.forestArea.polygon, copernicusAnalysis, isCopernicusLayer, observations],
  );
  const coverage = corridorCoverage;
  const heatmapRequest = useMemo(() => ({ observations, layer: activeLayer, polygon: activeScenario.forestArea.polygon }), [activeLayer, activeScenario.forestArea.polygon, observations]);
  const debouncedHeatmapRequest = useDebouncedValue(heatmapRequest, 1_000);
  const heatmapDisplayOptions = useMemo(() => ({ mode: heatmapInterpolationMode, maxDistanceMeters: heatmapMaxDistanceMeters, minConfidence: heatmapMinConfidence }), [heatmapInterpolationMode, heatmapMaxDistanceMeters, heatmapMinConfidence]);
  const { image: interpolatedForestHeatmap, loading: isHeatmapWorkerLoading } = useForestHeatmap(debouncedHeatmapRequest.observations, debouncedHeatmapRequest.layer, debouncedHeatmapRequest.polygon, forestDataDisplayMode === "surface" && !isCopernicusLayer, heatmapDisplayOptions);
  const isHeatmapUpdatePending = forestDataDisplayMode === "surface" && (debouncedHeatmapRequest !== heatmapRequest || isHeatmapWorkerLoading);
  const forestAverageValue = useMemo(() => {
    const values = corridorCoverage.map((cell) => cell.value).filter((value): value is number => value !== null);
    return values.length > 0 ? average(values) : null;
  }, [corridorCoverage]);
  const mapCenter = useMemo(() => centroidOf(activeScenario.forestArea.polygon), [activeScenario.forestArea.polygon]);
  const mapKey = canonicalForestArea.id;
  const weatherLocation = useMemo(() => (appView === "portal" && selectedMunicipality ? selectedMunicipality.center : mapCenter), [appView, mapCenter, selectedMunicipality]);
  const cellBounds = useMemo(() => buildCellBounds(coverage), [coverage]);
  const currentObservation = observations[currentIndex] ?? observations[0];
  const selectedObservation = useMemo(
    () => observations.find((observation) => observation.id === selectedCell?.sourceObservationId) ?? currentObservation,
    [currentObservation, observations, selectedCell],
  );
  const highRiskCount = observations.filter((observation) => observation.values.dryStress > 0.68 && observation.confidence > 0.62).length;
  const measuredCoverageCount = coverage.filter((cell) => cell.value !== null).length;
  const lowConfidenceCount = coverage.filter((cell) => cell.confidence < 0.5).length;
  const missionOverview = useMemo(() => buildMissionOverview(observations, coverage, copernicusAnalysis), [copernicusAnalysis, coverage, observations]);
  const routeAssessment = useMemo(() => buildRouteAssessment(missionOverview), [missionOverview]);
  const indexBuilderInitialValues = useMemo(
    () =>
      buildIndexBuilderValues({
        overview: missionOverview,
        biodiversityMetrics,
        copernicus: copernicusAnalysis,
        liveWeather,
      }),
    [biodiversityMetrics, copernicusAnalysis, liveWeather, missionOverview],
  );

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        if (index >= observations.length - 1) {
          setIsPlaying(false);
          return observations.length - 1;
        }
        return index + 1;
      });
    }, 260);
    return () => window.clearInterval(timer);
  }, [isPlaying, observations.length]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
    setSelectedCell(null);
    setIsMissionOverviewOpen(false);
  }, [seed, params, draftWaypoints]);

  useEffect(() => {
    void refreshBackendState();
  }, []);

  useEffect(() => {
    persistManagementFallback(managedMunicipalities, deploymentAreas, managedStakeholders, plannedMissions);
  }, [deploymentAreas, managedMunicipalities, managedStakeholders, plannedMissions]);

  useEffect(() => {
    setManagementSelection((current) => resolveManagementSelection(selectionCollections, current));
  }, [selectionCollections]);

  useEffect(() => {
    const controller = new AbortController();
    setWeatherStatus("loading");
    fetchLiveWeather(weatherLocation, controller.signal)
      .then((weather) => {
        setLiveWeather(weather);
        setWeatherStatus("live");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLiveWeather(buildFallbackWeather(weatherLocation));
        setWeatherStatus("fallback");
      });
    return () => controller.abort();
  }, [weatherLocation]);

  useEffect(() => {
    if (appView !== "geo" || !selectedArea || selectedArea.boundaryStatus !== "defined") {
      setGeoOsmForestPaths([]);
      setGeoOsmPathState("idle");
      setGeoOsmPathProgress(0);
      return;
    }
    const controller = new AbortController();
    setGeoOsmPathState("loading");
    setGeoOsmPathProgress(5);
    fetchOsmForestPaths(selectedArea, controller.signal, (progress) => { setGeoOsmPathProgress(progress.percent); setGeoOsmPathStatus(progress); })
      .then((paths) => {
        setGeoOsmForestPaths(paths);
        setGeoOsmPathState("ready");
        setGeoOsmPathProgress(100);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setGeoOsmForestPaths([]);
        setGeoOsmPathState("error");
        setGeoOsmPathProgress(0);
        setGeoOsmPathStatus({ percent: 0, stage: "error", message: errorMessage(error), count: 0 });
      });
    return () => controller.abort();
  }, [appView, geoOsmReloadKey, selectedArea]);

  useEffect(() => {
    if (customerMissionStatus === "processing" && currentIndex >= observations.length - 1) {
      setCustomerMissionStatus("bereit");
    }
  }, [currentIndex, customerMissionStatus, observations.length]);

  const syncManagementMutation = (mutation: ManagementMutation) => {
    if (mutation.kind === "area") return saveForestArea(mutation.payload as DeploymentArea);
    if (mutation.kind === "municipality") return saveMunicipality(mutation.payload as MunicipalityRecord);
    if (mutation.kind === "stakeholder") return saveStakeholder(mutation.payload as StakeholderRecord);
    return savePlannedMission(mutation.payload as PlannedMissionRecord);
  };

  const refreshBackendState = async () => {
    setManagementFeedback({ tone: "loading", message: "Verwaltungsdaten werden geladen …" });
    try {
      const syncResult = await flushManagementOutbox(syncManagementMutation);
      const [paths, scenarios, records, areas, municipalityRecords, stakeholderRecords, plannedMissionRecords] = await Promise.all([
        fetchSavedPaths(), fetchSavedScenarios(), fetchMissionRecords(), fetchForestAreas(), fetchMunicipalities(), fetchStakeholders(), fetchPlannedMissions(),
      ]);
      const mergedAreas = mergePendingEntities(areas, deploymentAreas, syncResult.pending, "area");
      const mergedMunicipalities = mergePendingEntities(municipalityRecords, managedMunicipalities, syncResult.pending, "municipality");
      const mergedStakeholders = mergePendingEntities(stakeholderRecords, managedStakeholders, syncResult.pending, "stakeholder");
      const mergedMissions = mergePendingEntities(plannedMissionRecords, plannedMissions, syncResult.pending, "mission");
      setSavedPaths(paths);
      setSavedScenarios(scenarios);
      setMissionRecords(records);
      setDeploymentAreas(mergedAreas);
      setManagedMunicipalities(mergedMunicipalities);
      setManagedStakeholders(mergedStakeholders);
      setPlannedMissions(mergedMissions);
      setPendingSyncCount(syncResult.pending.length);
      window.localStorage.setItem(savedPathsStorageKey, JSON.stringify(paths));
      window.localStorage.setItem(savedScenariosStorageKey, JSON.stringify(scenarios));
      persistManagementFallback(mergedMunicipalities, mergedAreas, mergedStakeholders, mergedMissions);
      setManagementFeedback(syncResult.pending.length
        ? { tone: "error", message: `${syncResult.pending.length} lokale Änderung(en) warten weiterhin auf Synchronisierung.` }
        : { tone: "success", message: syncResult.synced ? `${syncResult.synced} lokale Änderung(en) synchronisiert.` : "Verwaltungsdaten sind synchronisiert." });
    } catch (error) {
      const pending = readManagementOutbox();
      setPendingSyncCount(pending.length);
      setManagementFeedback({ tone: "error", message: `Backend nicht erreichbar. ${pending.length} lokale Änderung(en) bleiben in der Sync-Warteschlange. ${errorMessage(error)}` });
    }
  };

  const addDraftCoordinate = (coordinate: Coordinate) => {
    if (!isAdmin) return;
    setGeoSelectedOsmPathIds([]);
    setGeoOsmBaseRoute([]);
    setDraftWaypoints((current) => buildWaypoints([...current, coordinate]));
  };

  const toggleDetectedPathSegment = (path: OsmForestPath) => {
    if (!isAdmin) return;
    const isSelected = geoSelectedOsmPathIds.includes(path.id);
    const nextIds = isSelected
      ? geoSelectedOsmPathIds.filter((pathId) => pathId !== path.id)
      : [...geoSelectedOsmPathIds, path.id];
    const baseRoute = geoSelectedOsmPathIds.length === 0 ? draftWaypoints : geoOsmBaseRoute;
    if (geoSelectedOsmPathIds.length === 0) setGeoOsmBaseRoute(baseRoute);
    const selectedSegments = nextIds
      .map((pathId) => geoOsmForestPaths.find((candidate) => candidate.id === pathId))
      .filter((candidate): candidate is OsmForestPath => Boolean(candidate));
    setGeoSelectedOsmPathIds(nextIds);
    setDraftWaypoints(buildWaypoints(composeRouteSegments(baseRoute, selectedSegments)));
    setDraftPathName(nextIds.length ? `${selectedArea?.name ?? "Waldgebiet"} Gesamtfahrt` : selectedCustomerMission?.pathName ?? "Manuell erfasster Weg");
    setIsPathCaptureEnabled(false);
  };

  const selectAllDetectedPathSegments = () => {
    if (!isAdmin || geoOsmForestPaths.length === 0) return;
    const allPathIds = geoOsmForestPaths.map((path) => path.id);
    setGeoOsmBaseRoute([]);
    setGeoSelectedOsmPathIds(allPathIds);
    setDraftWaypoints(buildWaypoints(composeRouteSegments([], geoOsmForestPaths)));
    setDraftPathName(`${selectedArea?.name ?? "Waldgebiet"} Gesamtfahrt`);
    setIsPathCaptureEnabled(false);
    setManagementFeedback({ tone: "success", message: `${allPathIds.length} erkannte Wegabschnitte wurden ausgewählt. Einzelne Wege können auf der Karte wieder abgewählt werden.` });
  };

  const addManualWaypoint = () => {
    if (!isAdmin) return;
    const lat = Number.parseFloat(manualLat.replace(",", "."));
    const lng = Number.parseFloat(manualLng.replace(",", "."));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    addDraftCoordinate({ lat, lng });
  };

  const persistSavedPaths = (paths: SavedPathRecord[]) => {
    setSavedPaths(paths);
    window.localStorage.setItem(savedPathsStorageKey, JSON.stringify(paths));
  };

  const saveDraftPath = () => {
    if (!isAdmin || draftWaypoints.length < 2) return;
    const name = draftPathName.trim() || "Manuell erfasster Weg";
    const record: SavedPathRecord = {
      id: `path-${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      waypoints: buildWaypoints(draftWaypoints),
    };
    persistSavedPaths([record, ...savedPaths.filter((path) => path.name !== name)]);
    setGeoSelectedOsmPathIds([]);
    setGeoOsmBaseRoute([]);
    void savePathRecord(record).catch(() => undefined);
    if (selectedCustomerMission) {
      const updated: PlannedMissionRecord = {
        ...plannedMissions.find((item) => item.id === selectedCustomerMission.id)!,
        pathName: name,
        missionPath: createMissionPath(name, record.waypoints),
        status: "bereit",
        routeSummary: {
          averageDryStress: missionOverview.averageDryStress,
          averageConfidence: missionOverview.averageConfidence,
          observationCount: observations.length,
          calculatedAt: new Date().toISOString(),
          dataOrigin: "synthetic",
          dataStatus: "derived",
          source: `Mission ${selectedCustomerMission.id} / gespeicherter Missionsweg`,
          modelVersion: scenario.generatorVersion,
        },
        updatedAt: new Date().toISOString(),
      };
      setPlannedMissions((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      void savePlannedMission(updated).catch(() => {
        setPendingSyncCount(enqueueManagementMutation("mission", updated).length);
      });
      setManagementFeedback({ tone: "success", message: `${name} wurde der Mission dauerhaft zugeordnet.` });
    }
  };

  const loadSavedPath = (path: SavedPathRecord) => {
    if (!isAdmin) return;
    setGeoSelectedOsmPathIds([]);
    setGeoOsmBaseRoute([]);
    setDraftPathName(path.name);
    setDraftWaypoints(buildWaypoints(path.waypoints));
    setIsPathCaptureEnabled(false);
  };

  const deleteSavedPath = (pathId: string) => {
    if (!isAdmin) return;
    persistSavedPaths(savedPaths.filter((path) => path.id !== pathId));
    void deletePathRecord(pathId).catch(() => undefined);
  };

  const persistSavedScenarios = (records: SavedScenarioRecord[]) => {
    setSavedScenarios(records);
    window.localStorage.setItem(savedScenariosStorageKey, JSON.stringify(records));
  };

  const createScenarioRecord = (): SavedScenarioRecord => ({
    id: `scenario-${Date.now()}`,
    name: scenarioName.trim() || "Athene Szenario",
    savedAt: new Date().toISOString(),
    seed,
    params,
    pathName: draftPathName.trim() || "Manuell erfasster Weg",
    waypoints: buildWaypoints(draftWaypoints),
  });

  const saveCurrentScenario = () => {
    const record = createScenarioRecord();
    persistSavedScenarios([record, ...savedScenarios.filter((scenarioRecord) => scenarioRecord.name !== record.name)]);
    setSelectedScenarioId(record.id);
    void saveScenarioRecord(record).catch(() => undefined);
  };

  const loadScenario = (scenarioRecord: SavedScenarioRecord) => {
    setScenarioName(scenarioRecord.name);
    setSeed(scenarioRecord.seed);
    setParams(scenarioRecord.params);
    setDraftPathName(scenarioRecord.pathName);
    setDraftWaypoints(buildWaypoints(scenarioRecord.waypoints));
    setSelectedScenarioId(scenarioRecord.id);
    setIsPathCaptureEnabled(false);
  };

  const selectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    const scenarioRecord = savedScenarios.find((record) => record.id === scenarioId);
    if (scenarioRecord) loadScenario(scenarioRecord);
  };

  const deleteSavedScenario = () => {
    if (!selectedScenarioId) return;
    persistSavedScenarios(savedScenarios.filter((scenarioRecord) => scenarioRecord.id !== selectedScenarioId));
    void deleteScenarioRecord(selectedScenarioId).catch(() => undefined);
    setSelectedScenarioId("");
  };

  const loadCustomerMission = (missionTemplate: CustomerMissionTemplate) => {
    setGeoSelectedOsmPathIds([]);
    setGeoOsmBaseRoute([]);
    setScenarioName(missionTemplate.scenarioName);
    setSeed(missionTemplate.seed);
    setParams(missionTemplate.params);
    setDraftPathName(missionTemplate.missionPath?.name ?? missionTemplate.pathName);
    setDraftWaypoints(buildWaypoints(missionPathWaypoints(missionTemplate)));
    setSelectedScenarioId("");
    setCurrentIndex(0);
    setSelectedCell(null);
    setIsMissionOverviewOpen(false);
    setCustomerMissionStatus("geladen");
  };

  const startCustomerMissionProcessing = () => {
    if (!selectedCustomerMission || !hasDefinedMissionPath(selectedCustomerMission)) return;
    loadCustomerMission(selectedCustomerMission);
    setActiveLayerId("dryStress");
    setCustomerMissionStatus("processing");
    setIsPlaying(true);
  };

  const openGeoMissionFromPortal = (missionTemplate: CustomerMissionTemplate, startProcessing: boolean) => {
    selectManagementContext({ missionId: missionTemplate.id });
    setGeoContextMode("mission");
    setAppView("geo");
    loadCustomerMission(missionTemplate);
    setActiveLayerId("dryStress");
    if (startProcessing && hasDefinedMissionPath(missionTemplate)) {
      setCustomerMissionStatus("processing");
      setIsPlaying(true);
    }
  };

  const openAreaInGeo = (areaId: string) => {
    const area = deploymentAreas.find((item) => item.id === areaId);
    if (!area || !area.municipalityId) {
      setManagementFeedback({ tone: "error", message: "Dieses Einsatzgebiet ist keiner Gemeinde zugeordnet und muss zuerst geprüft werden." });
      return;
    }
    if (area.boundaryStatus === "pending") {
      setManagementFeedback({ tone: "error", message: "Bitte zuerst die ausstehende Gebietsgrenze auf der Karte einzeichnen." });
      openAreaOnMap(area.id);
      return;
    }
    selectManagementContext({ areaId: area.id, missionId: null });
    const linkedMission = portalMissions.find((item) => item.areaId === area.id);
    if (linkedMission) loadCustomerMission(linkedMission);
    else {
      setScenarioName(`${area.name} – Gebietsansicht`);
      setDraftWaypoints([]);
    }
    setGeoContextMode("area");
    setAppView("geo");
  };

  const openAreaOnMap = (areaId: string) => {
    const area = deploymentAreas.find((item) => item.id === areaId);
    if (!area || !area.municipalityId) {
      setManagementFeedback({ tone: "error", message: "Das Einsatzgebiet hat keine geprüfte Gemeindezuordnung." });
      return;
    }
    selectManagementContext({ areaId: area.id, missionId: null });
    setMapFocusAreaId(area.id);
    setAppView("adminMap");
  };

  const persistArea = async (area: DeploymentArea) => {
    const next = [area, ...deploymentAreas.filter((item) => item.id !== area.id)];
    setDeploymentAreas(next);
    if (area.municipalityId) setManagementSelection(resolveManagementSelection({ municipalities: managedMunicipalities, areas: next, missions: plannedMissions }, { areaId: area.id, missionId: null }));
    window.localStorage.setItem(forestAreasStorageKey, JSON.stringify(next));
    setManagementFeedback({ tone: "loading", message: `${area.name} wird gespeichert …` });
    try {
      const saved = await saveForestArea(area);
      setDeploymentAreas((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setPendingSyncCount(acknowledgeManagementMutation("area", saved.id).length);
      setManagementFeedback({ tone: "success", message: `${area.name} wurde gespeichert.` });
    } catch (error) {
      const pending = enqueueManagementMutation("area", area);
      setPendingSyncCount(pending.length);
      setManagementFeedback({ tone: "error", message: `${area.name} ist lokal gespeichert und für die Synchronisierung vorgemerkt. ${errorMessage(error)}` });
    }
  };

  const saveCurrentMission = async () => {
    if (!isAdmin || !selectedCustomerMission) return;
    const source = plannedMissions.find((item) => item.id === selectedCustomerMission.id);
    if (!source) return;
    const timestamp = new Date().toISOString();
    const hasRoute = draftWaypoints.length >= 2;
    const updated: PlannedMissionRecord = {
      ...source,
      seed,
      params,
      scenarioName: scenarioName.trim() || source.scenarioName,
      pathName: hasRoute ? draftPathName.trim() || source.pathName : source.pathName,
      missionPath: hasRoute ? createMissionPath(draftPathName.trim() || source.pathName, buildWaypoints(draftWaypoints)) : source.missionPath,
      status: hasRoute ? "bereit" : source.status,
      routeSummary: hasRoute ? {
        averageDryStress: missionOverview.averageDryStress,
        averageConfidence: missionOverview.averageConfidence,
        observationCount: observations.length,
        calculatedAt: timestamp,
        dataOrigin: "synthetic",
        dataStatus: "derived",
        source: `Mission ${source.id} / gespeicherter Missionsstand`,
        modelVersion: scenario.generatorVersion,
      } : source.routeSummary,
      updatedAt: timestamp,
    };
    setMissionSaveState("saving");
    setPlannedMissions((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
    try {
      const bundle = await saveMissionBundle(updated, createCurrentMissionRecord());
      const saved = bundle.plannedMission;
      const savedResult = bundle.missionRecord;
      setPlannedMissions((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setMissionRecords((current) => [savedResult, ...current.filter((item) => item.id !== savedResult.id)]);
      setPendingSyncCount(acknowledgeManagementMutation("mission", saved.id).length);
      setMissionSaveState("saved");
      setManagementFeedback({ tone: "success", message: `${saved.title} wurde mit ${savedResult.observations?.length ?? 0} Observationen und ${savedResult.detections?.length ?? 0} Detektionen vollständig gespeichert.` });
    } catch (error) {
      setMissionSaveState("error");
      setManagementFeedback({ tone: "error", message: `${updated.title} konnte nicht vollständig gespeichert werden. ${errorMessage(error)}` });
    }
  };

  useEffect(() => {
    if (missionSaveState === "idle" || missionSaveState === "saving") return;
    setMissionSaveState("idle");
  }, [draftPathName, draftWaypoints, params, scenarioName, seed]);

  const planForestMission = async (areaId: string, values: { title: string; objective: string; priority: PlannedMissionRecord["priority"]; route: Coordinate[]; dataMode?: "real" | "mock"; allowEmptyRoute?: boolean; requestedAt?: string }) => {
    const area = deploymentAreas.find((item) => item.id === areaId);
    if (!area?.municipalityId) throw new Error("Das Waldgebiet ist keiner Gemeinde zugeordnet.");
    if (values.route.length < 2 && !values.allowEmptyRoute) throw new Error("Bitte mindestens zwei Routenpunkte einzeichnen.");
    const timestamp = new Date().toISOString();
    const waypoints = buildWaypoints(values.route);
    const record: PlannedMissionRecord = {
      id: `plan-${Date.now().toString(36)}`,
      municipalityId: area.municipalityId,
      areaId: area.id,
      title: values.title.trim(),
      objective: values.objective.trim(),
      priority: values.priority,
      status: "geplant",
      seed: `ATHENE-${area.id}-${Date.now()}`,
      scenarioName: values.title.trim(),
      pathName: `${area.name} Route`,
      missionPath: waypoints.length >= 2 ? createMissionPath(`${area.name} Route`, waypoints) : null,
      dataMode: values.dataMode ?? "mock",
      params: defaultScenarioParams,
      requestedAt: values.requestedAt ? new Date(`${values.requestedAt}T12:00:00`).toISOString() : timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setPlannedMissions((current) => [record, ...current]);
    setManagementSelection(resolveManagementSelection({ municipalities: managedMunicipalities, areas: deploymentAreas, missions: [record, ...plannedMissions] }, { missionId: record.id }));
    try {
      const saved = await savePlannedMission(record);
      setPlannedMissions((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setPendingSyncCount(acknowledgeManagementMutation("mission", saved.id).length);
      setManagementFeedback({ tone: "success", message: `${record.title} wurde geplant.` });
    } catch (error) {
      const pending = enqueueManagementMutation("mission", record);
      setPendingSyncCount(pending.length);
      setManagementFeedback({ tone: "error", message: `${record.title} wurde lokal geplant und für die Synchronisierung vorgemerkt. ${errorMessage(error)}` });
    }
  };

  const updateMissionDate = (date: string) => {
    if (!isAdmin || !selectedCustomerMission || !date) return;
    const source = plannedMissions.find((item) => item.id === selectedCustomerMission.id);
    if (!source) return;
    const updated = { ...source, requestedAt: new Date(`${date}T12:00:00`).toISOString(), updatedAt: new Date().toISOString() };
    setPlannedMissions((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
    void savePlannedMission(updated).catch(() => setPendingSyncCount(enqueueManagementMutation("mission", updated).length));
  };

  const removePlannedMission = async (missionId: string) => {
    const missionToDelete = plannedMissions.find((missionItem) => missionItem.id === missionId);
    if (!missionToDelete) return;
    const deletedResults = missionRecords.filter((record) => record.missionId === missionId);
    setPlannedMissions((current) => current.filter((missionItem) => missionItem.id !== missionId));
    setMissionRecords((current) => current.filter((record) => record.missionId !== missionId));
    if (selectedCustomerMissionId === missionId) selectManagementContext({ areaId: missionToDelete.areaId, missionId: null });
    try {
      await deletePlannedMission(missionId, true);
      setManagementFeedback({ tone: "success", message: `${missionToDelete.title} und alle zugehörigen Ergebnisse wurden dauerhaft gelöscht.` });
    } catch (error) {
      setPlannedMissions((current) => [missionToDelete, ...current.filter((missionItem) => missionItem.id !== missionId)]);
      setMissionRecords((current) => [...deletedResults, ...current.filter((record) => record.missionId !== missionId)]);
      setManagementFeedback({ tone: "error", message: `${missionToDelete.title} konnte nicht gelöscht werden. ${errorMessage(error)}` });
    }
  };

  const archivePlannedMission = async (missionId: string) => {
    const existing = plannedMissions.find((missionItem) => missionItem.id === missionId);
    if (!existing) return;
    const timestamp = new Date().toISOString();
    const archived: PlannedMissionRecord = { ...existing, status: "archiviert", archivedAt: timestamp, updatedAt: timestamp };
    setPlannedMissions((current) => [archived, ...current.filter((missionItem) => missionItem.id !== missionId)]);
    if (selectedCustomerMissionId === missionId) selectManagementContext({ areaId: existing.areaId, missionId: null });
    try {
      const saved = await savePlannedMission(archived);
      setPlannedMissions((current) => [saved, ...current.filter((missionItem) => missionItem.id !== missionId)]);
      setManagementFeedback({ tone: "success", message: `${existing.title} wurde archiviert. Gespeicherte Ergebnisse bleiben erhalten.` });
    } catch (error) {
      setPlannedMissions((current) => [existing, ...current.filter((missionItem) => missionItem.id !== missionId)]);
      setManagementFeedback({ tone: "error", message: `${existing.title} konnte nicht archiviert werden. ${errorMessage(error)}` });
    }
  };

  const archiveArea = async (areaId: string) => {
    const existing = deploymentAreas.find((area) => area.id === areaId);
    if (!existing) return;
    const timestamp = new Date().toISOString();
    await persistArea({ ...existing, status: "archiviert", archivedAt: timestamp, updatedAt: timestamp });
  };

  const submitManagementForm = async (values: ManagementFormData) => {
    const timestamp = new Date().toISOString();
    setManagementDialog(null);
    let offlineMutation: { kind: "municipality" | "stakeholder" | "mission"; payload: MunicipalityRecord | StakeholderRecord | PlannedMissionRecord } | null = null;
    try {
      if (values.kind === "municipality") {
        const existing = editingMunicipalityId ? managedMunicipalities.find((item) => item.id === editingMunicipalityId) : null;
        const record: MunicipalityRecord = {
          ...existing,
          id: existing?.id ?? `mun-${slugify(values.name)}-${Date.now().toString(36)}`,
          name: values.name,
          type: values.type,
          region: values.region,
          population: values.population,
          center: values.center,
          administrativeScopeId: existing?.administrativeScopeId ?? null,
          status: existing?.status ?? "active",
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        const next = [record, ...managedMunicipalities.filter((item) => item.id !== record.id)];
        setManagedMunicipalities(next);
        setManagementSelection(resolveManagementSelection({ municipalities: next, areas: deploymentAreas, missions: plannedMissions }, { municipalityId: record.id }));
        offlineMutation = { kind: "municipality", payload: record };
        const saved = await saveMunicipality(record);
        setManagedMunicipalities((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setPendingSyncCount(acknowledgeManagementMutation("municipality", saved.id).length);
        setEditingMunicipalityId(null);
        setManagementFeedback({ tone: "success", message: `${record.name} wurde gespeichert.` });
      } else if (values.kind === "stakeholder") {
        if (!selectedMunicipality) throw new Error("Bitte zuerst eine Gemeinde auswählen.");
        const existing = editingStakeholderId ? managedStakeholders.find((item) => item.id === editingStakeholderId) : null;
        const record: StakeholderRecord = { ...existing, id: existing?.id ?? `stakeholder-${Date.now().toString(36)}`, municipalityId: selectedMunicipality.id, name: values.name, role: values.role, access: values.access, status: existing?.status ?? "active", createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp };
        setManagedStakeholders((current) => [record, ...current.filter((item) => item.id !== record.id)]);
        offlineMutation = { kind: "stakeholder", payload: record };
        const saved = await saveStakeholder(record);
        setManagedStakeholders((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setPendingSyncCount(acknowledgeManagementMutation("stakeholder", saved.id).length);
        setEditingStakeholderId(null);
        setManagementFeedback({ tone: "success", message: `${record.name} wurde als Stakeholder gespeichert.` });
      } else if (values.kind === "area") {
        if (!selectedMunicipality) throw new Error("Bitte zuerst eine Gemeinde auswählen.");
        const existing = editingAreaId ? deploymentAreas.find((item) => item.id === editingAreaId) : null;
        const center = selectedMunicipality.center;
        const polygon = existing?.polygon ?? [
          { lat: center.lat - 0.002, lng: center.lng - 0.003 }, { lat: center.lat + 0.002, lng: center.lng - 0.003 },
          { lat: center.lat + 0.002, lng: center.lng + 0.003 }, { lat: center.lat - 0.002, lng: center.lng + 0.003 },
        ];
        const record = normalizeDeploymentArea({
          ...existing,
          id: existing?.id ?? `area-${Date.now().toString(36)}`,
          municipalityId: selectedMunicipality.id,
          scopeId: existing?.scopeId ?? selectedMunicipality.id,
          scopeName: existing?.scopeName ?? selectedMunicipality.name,
          name: values.name,
          focus: values.focus,
          description: values.description,
          status: values.status,
          polygon,
          boundaryStatus: existing?.boundaryStatus ?? "pending",
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
          source: existing?.source ?? "Verwaltungsportal",
        });
        await persistArea(record);
        setEditingAreaId(null);
      } else {
        const area = deploymentAreas.find((item) => item.id === values.areaId);
        if (!area?.municipalityId) throw new Error("Bitte ein zugeordnetes Einsatzgebiet auswählen.");
        const record: PlannedMissionRecord = {
          id: `plan-${Date.now().toString(36)}`,
          municipalityId: area.municipalityId,
          areaId: area.id,
          title: values.title,
          objective: values.objective,
          priority: values.priority,
          status: "geplant",
          seed: `ATHENE-${area.id}-${Date.now()}`,
          scenarioName: values.title,
          pathName: `${area.name} Route`,
          missionPath: null,
          params: defaultScenarioParams,
          requestedAt: values.requestedAt,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        setPlannedMissions((current) => [record, ...current]);
        setManagementSelection(resolveManagementSelection({ municipalities: managedMunicipalities, areas: deploymentAreas, missions: [record, ...plannedMissions] }, { missionId: record.id }));
        offlineMutation = { kind: "mission", payload: record };
        const saved = await savePlannedMission(record);
        setPlannedMissions((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        setPendingSyncCount(acknowledgeManagementMutation("mission", saved.id).length);
        setManagementFeedback({ tone: "success", message: `${record.title} wurde geplant.` });
      }
    } catch (error) {
      if (offlineMutation) {
        const pending = enqueueManagementMutation(offlineMutation.kind, offlineMutation.payload);
        setPendingSyncCount(pending.length);
      }
      setManagementFeedback({ tone: "error", message: `Speichern im Backend fehlgeschlagen; die lokale Änderung bleibt in der Sync-Warteschlange. ${errorMessage(error)}` });
    }
  };

  const archiveMunicipality = async (municipalityId: string) => {
    const record = managedMunicipalities.find((item) => item.id === municipalityId);
    if (!record) return;
    if (managedMunicipalities.filter((item) => item.status !== "archived").length <= 1) {
      setManagementFeedback({ tone: "error", message: "Die letzte aktive Gemeinde kann nicht archiviert werden." });
      return;
    }
    const timestamp = new Date().toISOString();
    const archived = { ...record, status: "archived" as const, archivedAt: timestamp, updatedAt: timestamp };
    setManagedMunicipalities((current) => [archived, ...current.filter((item) => item.id !== archived.id)]);
    try {
      await saveMunicipality(archived);
      setPendingSyncCount(acknowledgeManagementMutation("municipality", archived.id).length);
      setManagementFeedback({ tone: "success", message: `${archived.name} wurde archiviert.` });
    }
    catch (error) {
      const pending = enqueueManagementMutation("municipality", archived);
      setPendingSyncCount(pending.length);
      setManagementFeedback({ tone: "error", message: `Gemeinde lokal archiviert; Synchronisierung ausstehend. ${errorMessage(error)}` });
    }
  };

  const archiveStakeholder = async (stakeholderId: string) => {
    const record = managedStakeholders.find((item) => item.id === stakeholderId);
    if (!record) return;
    const timestamp = new Date().toISOString();
    const archived = { ...record, status: "archived" as const, archivedAt: timestamp, updatedAt: timestamp };
    setManagedStakeholders((current) => [archived, ...current.filter((item) => item.id !== archived.id)]);
    try {
      await saveStakeholder(archived);
      setPendingSyncCount(acknowledgeManagementMutation("stakeholder", archived.id).length);
      setManagementFeedback({ tone: "success", message: `${archived.name} wurde archiviert.` });
    }
    catch (error) {
      const pending = enqueueManagementMutation("stakeholder", archived);
      setPendingSyncCount(pending.length);
      setManagementFeedback({ tone: "error", message: `Stakeholder lokal archiviert; Synchronisierung ausstehend. ${errorMessage(error)}` });
    }
  };

  const downloadCurrentScenario = () => {
    downloadJson(createScenarioRecord(), `${slugify(scenarioName || "athene-szenario")}.json`);
  };

  const importScenario = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const imported = normalizeScenarioRecord(JSON.parse(await file.text()));
      persistSavedScenarios([imported, ...savedScenarios.filter((scenarioRecord) => scenarioRecord.id !== imported.id && scenarioRecord.name !== imported.name)]);
      void saveScenarioRecord(imported).catch(() => undefined);
      loadScenario(imported);
    } catch {
      window.alert("Die Datei konnte nicht als Athene-Szenario gelesen werden.");
    }
  };

  const chartData = observations.map((observation) => ({
    minute: Math.round(observation.minute),
    temperature: observation.values.temperature,
    humidity: observation.values.humidity,
    dryStress: observation.values.dryStress,
    confidence: observation.confidence,
  }));

  const persistCurrentMissionRecord = async () => {
    const record = createCurrentMissionRecord();
    const saved = await saveMissionRecord(record);
    setMissionRecords((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
  };

  const createCurrentMissionRecord = () =>
    createMissionRecord({
      missionId: selectedCustomerMission?.id ?? mission.id,
      areaId: mission.areaId,
      municipalityId: mission.municipalityId,
      scenarioName,
      forestAreaName: activeScenario.forestArea.name,
      pathName: activeForestPath.name,
      seed,
      generatorVersion: scenario.generatorVersion,
      missionStartedAt: mission.startsAt,
      missionCompletedAt: new Date(new Date(mission.startsAt).getTime() + mission.durationMinutes * 60_000).toISOString(),
      coverageShare: selectedArea ? calculateRouteCoverageShare(activeRouteLengthMeters, measurementCorridorWidthMeters, selectedArea.hectares) : null,
      overview: missionOverview,
      copernicus: copernicusAnalysis,
      biodiversityMetrics,
      observations,
      missionPath: createMissionPath(activeForestPath.name, buildWaypoints(activeForestPath.waypoints)),
      scenarioParams: params,
      existingCreatedAt: missionRecords.find((record) => record.missionId === (selectedCustomerMission?.id ?? mission.id))?.createdAt,
    });

  const exportCurrentMissionRecord = () => {
    downloadJson(createCurrentMissionRecord(), `${slugify(scenarioName || mission.id)}-mission-record.json`);
  };

  const exportMissionRecord = (record: MissionRecord) => {
    downloadJson(record, `${slugify(record.scenarioName || record.missionId)}-${record.createdAt.slice(0, 10)}.json`);
  };

  const removeMissionRecord = async (recordId: string) => {
    setMissionRecords((current) => current.filter((record) => record.id !== recordId));
    await deleteMissionRecord(recordId).catch(() => undefined);
  };

  const saveCustomIndex = (definition: CustomIndexDefinition) => {
    setCustomIndexes((current) => {
      const next = [definition, ...current.filter((item) => item.indexCode !== definition.indexCode)];
      window.localStorage.setItem(customIndexesStorageKey, JSON.stringify(next));
      return next;
    });
    updateIndexDisplaySetting(definition.indexCode, { visible: true, favorite: true, channel: "Admin", displayMode: "Detail" });
  };

  const updateIndexDisplaySetting = (indexCode: string, patch: Partial<IndexDisplaySetting>) => {
    setIndexDisplaySettings((current) => {
      const existing = getIndexDisplaySetting(current, indexCode);
      const nextSetting = { ...existing, ...patch, indexCode };
      const next = [nextSetting, ...current.filter((setting) => setting.indexCode !== indexCode)];
      window.localStorage.setItem(indexDisplaySettingsStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const setAllIndexVisibility = (visible: boolean) => {
    setIndexDisplaySettings((current) => {
      const next = allIndexDefinitions.map((definition) => ({ ...getIndexDisplaySetting(current, definition.indexCode), visible }));
      window.localStorage.setItem(indexDisplaySettingsStorageKey, JSON.stringify(next));
      return next;
    });
  };

  if (appView === "portal") {
    return (
      <PortalPage
        role={portalRole}
        onRoleChange={(role) => { void changePortalRole(role); }}
        municipalities={portalMunicipalities}
        areas={deploymentAreas}
        missions={portalMissions}
        selectedMunicipalityId={selectedMunicipalityId ?? ""}
        liveWeather={liveWeather}
        weatherStatus={weatherStatus}
        biodiversityMetrics={biodiversityMetrics}
        indexDefinitions={displayedIndexDefinitions}
        onSelectMunicipality={(municipalityId) => selectManagementContext({ municipalityId })}
        onReorderMunicipalities={reorderMunicipalities}
        onOpenMunicipalityMap={(municipalityId) => { selectManagementContext({ municipalityId }); setMapFocusAreaId(null); setMapFocusMunicipalityId(municipalityId); setAppView("adminMap"); }}
        onOpenMission={(mission, startProcessing) => { setGeoParentView("portal"); openGeoMissionFromPortal(mission, startProcessing); }}
        onOpenAreaMap={openAreaOnMap}
        onCreateMunicipality={() => { setEditingMunicipalityId(null); setManagementDialog("municipality"); }}
        onEditMunicipality={(municipalityId) => { setEditingMunicipalityId(municipalityId); setManagementDialog("municipality"); }}
        onArchiveMunicipality={archiveMunicipality}
        onCreateStakeholder={() => setManagementDialog("stakeholder")}
        onEditStakeholder={(stakeholderId) => { setEditingStakeholderId(stakeholderId); setManagementDialog("stakeholder"); }}
        onArchiveStakeholder={archiveStakeholder}
        onCreateArea={() => { setEditingAreaId(null); setManagementDialog("area"); }}
        onEditArea={(areaId) => { setEditingAreaId(areaId); setManagementDialog("area"); }}
        onArchiveArea={archiveArea}
        onPlanMission={() => setManagementDialog("mission")}
        managementDialog={managementDialog}
        editingArea={deploymentAreas.find((area) => area.id === editingAreaId) ?? null}
        editingMunicipality={managedMunicipalities.find((item) => item.id === editingMunicipalityId) ?? null}
        editingStakeholder={managedStakeholders.find((item) => item.id === editingStakeholderId) ?? null}
        onCloseDialog={() => { setManagementDialog(null); setEditingAreaId(null); setEditingMunicipalityId(null); setEditingStakeholderId(null); }}
        onSubmitDialog={submitManagementForm}
        feedback={managementFeedback}
        pendingSyncCount={pendingSyncCount}
        onOpenIndexBuilder={() => setAppView("indexBuilder")}
        onOpenHyperion={() => setAppView("hyperion")}
        onOpenAdminMap={() => { setMapFocusAreaId(null); setMapFocusMunicipalityId(null); setAppView("adminMap"); }}
        onOpenRegionalOverview={() => setAppView("regionalOverview")}
      />
    );
  }

  if (appView === "missionUpload" && missionUploadContext) {
    const uploadArea = deploymentAreas.find((area) => area.id === missionUploadContext.areaId);
    if (uploadArea) {
      return (
        <RealMissionUploadPage
          area={uploadArea}
          route={missionUploadContext.route}
          onBack={() => setAppView("adminMap")}
          onCreateMission={(values) => planForestMission(uploadArea.id, { ...values, route: missionUploadContext.route, dataMode: "real" })}
        />
      );
    }
  }

  if (appView === "adminMap") {
    return (
      <BadenWuerttembergMapPage
        canManage={isAdmin}
        municipalities={portalMunicipalities}
        missions={portalMissions}
        missionRecords={missionRecords}
        forestAreas={deploymentAreas}
        selectedAreaId={selectedAreaId ?? ""}
        focusAreaId={mapFocusAreaId}
        focusMunicipalityId={mapFocusMunicipalityId}
        initialDetailAreaId={mapDetailAreaId}
        initialBaseMapId={baseMapId}
        selectedMunicipalityId={selectedMunicipalityId ?? ""}
        onSelectArea={(areaId, preserveViewport = false) => { selectManagementContext({ areaId, missionId: null }); if (!preserveViewport) setMapFocusAreaId(areaId); }}
        onSelectMunicipalityContext={(municipalityId) => selectManagementContext({ municipalityId, areaId: municipalityId ? undefined : null, missionId: null })}
        onClearAreaFocus={() => setMapFocusAreaId(null)}
        onSaveArea={persistArea}
        onPlanForestMission={planForestMission}
        onDetailAreaChange={setMapDetailAreaId}
        onBaseMapChange={setBaseMapId}
        onOpenRealMissionUpload={(areaId, route) => { setMapDetailAreaId(areaId); setMissionUploadContext({ areaId, route }); setAppView("missionUpload"); }}
        onOpenMockMission={(areaId) => {
          selectManagementContext({ areaId, missionId: null });
          const area = deploymentAreas.find((item) => item.id === areaId);
          const title = `${area?.name ?? "Waldgebiet"} Mock-Mission`;
          void planForestMission(areaId, { title, objective: "Neue Mock-Mission ohne vordefinierten Missionspfad", priority: "normal", route: [], dataMode: "mock", allowEmptyRoute: true }).then(() => {
            setScenarioName(title);
            setDraftPathName(`${area?.name ?? "Waldgebiet"} Route`);
            setDraftWaypoints([]);
            setIsPathCaptureEnabled(false);
            setGeoContextMode("mission");
            setMapDetailAreaId(areaId);
            setGeoParentView("adminMap");
            setAppView("geo");
          });
        }}
        onOpenMission={(mission) => {
          setMapDetailAreaId(mission.areaId);
          setGeoParentView("adminMap");
          openGeoMissionFromPortal(mission, false);
        }}
        onDeleteMission={removePlannedMission}
        onArchiveMission={archivePlannedMission}
        onArchiveArea={archiveArea}
        feedback={managementFeedback}
        onBackToPortal={() => setAppView("portal")}
        onOpenGeo={() => { if (selectedAreaId) { setGeoParentView("adminMap"); openAreaInGeo(selectedAreaId); } }}
      />
    );
  }

  if (appView === "regionalOverview") {
    return (
      <RegionalConditionOverview
        municipalities={managedMunicipalities}
        areas={deploymentAreas}
        records={missionRecords}
        onBack={() => setAppView("portal")}
        onOpenArea={openAreaInGeo}
      />
    );
  }

  if (appView === "hyperion") {
    return (
      <HyperionPage
        municipalities={portalMunicipalities}
        areas={deploymentAreas}
        items={hyperionItems}
        selectedMunicipalityId={selectedMunicipalityId ?? ""}
        onSelectMunicipality={(municipalityId) => selectManagementContext({ municipalityId })}
        onBackToPortal={() => setAppView("portal")}
        onOpenArea={openAreaInGeo}
        onOpenIndexBuilder={() => setAppView("indexBuilder")}
      />
    );
  }

  if (appView === "indexBuilder") {
    return (
      <IndexBuilderPage
        initialValues={indexBuilderInitialValues}
        definitions={displayedIndexDefinitions}
        allDefinitions={allIndexDefinitions}
        displaySettings={indexDisplaySettings}
        onSaveCustomIndex={saveCustomIndex}
        onUpdateDisplaySetting={updateIndexDisplaySetting}
        onSetAllIndexVisibility={setAllIndexVisibility}
        onBackToPortal={() => setAppView("portal")}
        onOpenGeo={() => setAppView("geo")}
      />
    );
  }

  if (appView === "geo" && geoContextMode === "area" && selectedArea && selectedMunicipality) {
    return (
      <AreaContextPage
        municipality={selectedMunicipality}
        area={selectedArea}
        missions={portalMissions.filter((item) => item.areaId === selectedArea.id)}
        records={missionRecords.filter((record) => record.areaId === selectedArea.id)}
        onBackToPortal={() => setAppView("portal")}
        onOpenMission={(missionItem) => openGeoMissionFromPortal(missionItem, false)}
        onOpenMap={() => openAreaOnMap(selectedArea.id)}
      />
    );
  }

  if (isMissionOverviewOpen) {
    return (
      <MissionOverviewPage
        canManage={isAdmin}
        scenarioName={scenarioName}
        missionId={mission.id}
        vehicle={mission.vehicle}
        forestAreaName={activeScenario.forestArea.name}
        pathName={activeForestPath.name}
        seed={seed}
        generatorVersion={scenario.generatorVersion}
        copernicus={copernicusAnalysis}
        overview={missionOverview}
        observations={observations}
        speciesObservations={speciesObservations}
        biodiversityMetrics={biodiversityMetrics}
        indexDefinitions={displayedIndexDefinitions}
        records={missionRecords.filter((record) => record.missionId === mission.id)}
        onSaveRecord={persistCurrentMissionRecord}
        onExportCurrentRecord={exportCurrentMissionRecord}
        onExportRecord={exportMissionRecord}
        onDeleteRecord={removeMissionRecord}
        onBack={() => setIsMissionOverviewOpen(false)}
      />
    );
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <header className="brandBlock">
          <div className="brandMark">
            <Satellite size={20} />
          </div>
          <div>
            <p className="eyebrow">Artemis Civil Systems</p>
            <h1>Project Athene</h1>
          </div>
        </header>
        <button className="portalBackButton" onClick={() => geoParentView === "adminMap" ? setAppView("adminMap") : setGeoContextMode("area")} type="button">
          <ArrowLeft size={16} />
          {geoParentView === "adminMap" ? "Zum Waldgebiet" : "Zum Einsatzgebiet"}
        </button>
        {isAdmin && <button className="portalBackButton" onClick={() => setAppView("indexBuilder")} type="button">
          <BarChart3 size={16} />
          Index Builder
        </button>}

        <section className="panel geoContextPanel">
          <PanelTitle icon={<Building2 size={18} />} title="Analysekontext" />
          <label className="fieldLabel">
            Gemeinde
            <select value={selectedMunicipalityId ?? ""} onChange={(event) => {
              const municipalityId = event.target.value;
              selectManagementContext({ municipalityId });
            }}>
              {managedMunicipalities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="fieldLabel">
            Einsatzgebiet
            <select value={selectedArea?.id ?? ""} onChange={(event) => openAreaInGeo(event.target.value)}>
              {deploymentAreas.filter((area) => area.municipalityId === selectedMunicipalityId && area.status !== "archiviert").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
          <label className="fieldLabel">
            Mission
            <select value={selectedCustomerMission?.id ?? ""} onChange={(event) => {
              const missionItem = portalMissions.find((item) => item.id === event.target.value);
              if (missionItem) openGeoMissionFromPortal(missionItem, false);
            }}>
              <option value="">Keine Mission gewählt</option>
              {portalMissions.filter((item) => item.areaId === selectedArea?.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          {isAdmin && selectedCustomerMission && <label className="fieldLabel">
            Erhebungsdatum
            <input type="date" value={selectedCustomerMission.requestedAt.slice(0, 10)} onChange={(event) => updateMissionDate(event.target.value)} />
          </label>}
          <div className="contextModeSwitch">
            <button type="button" onClick={() => setGeoContextMode("area")}>Gebietsansicht</button>
            <button className="active" type="button">Missionsansicht</button>
          </div>
          {!isAdmin && <p className="customerReadOnlyNotice"><ShieldCheck size={14} /> Nur-Lese-Ansicht: Missionsweg, Datum und Missionsdaten können ausschließlich durch Admins geändert werden.</p>}
          <small>{selectedMunicipality?.name} → {selectedArea?.name} → {selectedCustomerMission?.title ?? "Keine Mission"}</small>
        </section>

        {isAdmin && <section className="panel">
          <PanelTitle icon={<MapPinned size={18} />} title="Scenario Builder" />
          <label className="fieldLabel">
            Szenarioname
            <input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} />
          </label>
          <label className="fieldLabel">
            Gespeicherte Szenarien
            <select value={selectedScenarioId} onChange={(event) => selectScenario(event.target.value)}>
              <option value="">Szenario auswählen</option>
              {savedScenarios.map((scenarioRecord) => (
                <option key={scenarioRecord.id} value={scenarioRecord.id}>
                  {scenarioRecord.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fieldLabel" htmlFor="seed">
            Seed
          </label>
          <div className="seedRow">
            <input id="seed" value={seed} onChange={(event) => setSeed(event.target.value)} />
            <button className="iconButton" aria-label="Seed zurücksetzen" title="Seed zurücksetzen" onClick={() => setSeed(initialSeed)}>
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="gridTwo">
            <SelectField
              label="Waldtyp"
              value={params.forestType}
              options={["Mischwald", "Nadelwald", "Laubwald", "Aufforstungsfläche"]}
              onChange={(value) => setParams((current) => ({ ...current, forestType: value as ScenarioParams["forestType"] }))}
            />
            <SelectField
              label="Jahreszeit"
              value={params.season}
              options={["Sommer", "Frühjahr", "Herbst", "Winter"]}
              onChange={(value) => setParams((current) => ({ ...current, season: value as ScenarioParams["season"] }))}
            />
          </div>

          <RangeField label="Trockenstress" value={params.drought} onChange={(drought) => setParams((current) => ({ ...current, drought }))} />
          <RangeField label="Belastung" value={params.pollution} onChange={(pollution) => setParams((current) => ({ ...current, pollution }))} />
          <RangeField label="Schädlingsdruck" value={params.pestPressure} onChange={(pestPressure) => setParams((current) => ({ ...current, pestPressure }))} />
          <RangeField label="Sturmschaden" value={params.stormDamage} onChange={(stormDamage) => setParams((current) => ({ ...current, stormDamage }))} />
          <div className="scenarioActionGrid">
            <button className="commandButton primary" onClick={saveCurrentScenario}>
              <Save size={16} />
              Speichern
            </button>
            <button className="commandButton" onClick={downloadCurrentScenario}>
              <Download size={16} />
              Download
            </button>
            <button className="commandButton" onClick={() => importScenarioInputRef.current?.click()}>
              <Upload size={16} />
              Import
            </button>
            <button className="iconButton danger" aria-label="Szenario löschen" title="Szenario löschen" onClick={deleteSavedScenario} disabled={!selectedScenarioId}>
              <Trash2 size={16} />
            </button>
          </div>
          <input ref={importScenarioInputRef} className="fileInput" type="file" accept="application/json,.json" onChange={importScenario} />
        </section>}

        <section className="panel">
          <PanelTitle icon={<Layers size={18} />} title="Layer" />
          <div className="layerList">
            {layerDefinitions.filter((layer) => !copernicusLayerIds.includes(layer.id)).map((layer) => (
              <button
                key={layer.id}
                className={`layerButton ${activeLayerId === layer.id ? "active" : ""}`}
                onClick={() => {
                  setActiveLayerId(layer.id);
                  setSelectedCell(null);
                }}
              >
                <span className="swatch" style={{ background: `linear-gradient(90deg, ${layer.palette.join(", ")})` }} />
                <span>{layer.name}</span>
                <small>{layer.level}</small>
              </button>
            ))}
          </div>
          <div className="layerGroupHeader">
            <Satellite size={15} />
            <span>Copernicus Sentinel-2</span>
          </div>
          <div className="layerList">
            {layerDefinitions.filter((layer) => copernicusLayerIds.includes(layer.id)).map((layer) => (
              <button
                key={layer.id}
                className={`layerButton ${activeLayerId === layer.id ? "active" : ""}`}
                onClick={() => {
                  setActiveLayerId(layer.id);
                  setSelectedCell(null);
                }}
              >
                <span className="swatch" style={{ background: `linear-gradient(90deg, ${layer.palette.join(", ")})` }} />
                <span>{layer.name}</span>
                <small>{layer.level}</small>
              </button>
            ))}
          </div>
          <div className="copernicusStatus">
            <strong>{copernicusConfig.enabled ? "API bereit" : "Demo-Fallback aktiv"}</strong>
            <span>
              {copernicusAnalysis.scene.collection} · {copernicusAnalysis.scene.date} · {copernicusAnalysis.scene.cloudCover}% Wolken
            </span>
          </div>
          <RangeField label="Layer-Transparenz" value={layerOpacity} onChange={setLayerOpacity} />
        </section>

        {isAdmin && <section className="panel">
          <PanelTitle icon={<MapPinned size={18} />} title="Wege erfassen" />
          <label className="fieldLabel">
            Wegname
            <input value={draftPathName} onChange={(event) => setDraftPathName(event.target.value)} />
          </label>
          <div className="gridTwo">
            <label className="fieldLabel">
              Latitude
              <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} inputMode="decimal" />
            </label>
            <label className="fieldLabel">
              Longitude
              <input value={manualLng} onChange={(event) => setManualLng(event.target.value)} inputMode="decimal" />
            </label>
          </div>
          <div className="pathActionGrid">
            <button className="commandButton primary" onClick={addManualWaypoint}>
              <Plus size={16} />
              Punkt
            </button>
            <button className={`commandButton ${isPathCaptureEnabled ? "active" : ""}`} onClick={() => setIsPathCaptureEnabled((enabled) => !enabled)}>
              <MapPinned size={16} />
              Karte
            </button>
            <button className="iconButton" aria-label="Letzten Punkt entfürnen" title="Letzten Punkt entfürnen" onClick={() => setDraftWaypoints((current) => buildWaypoints(current.slice(0, -1)))}>
              <Undo2 size={16} />
            </button>
            <button className="iconButton danger" aria-label="Manuellen Weg löschen" title="Manuellen Weg löschen" onClick={() => { setDraftWaypoints([]); setGeoSelectedOsmPathIds([]); setGeoOsmBaseRoute([]); }}>
              <Trash2 size={16} />
            </button>
          </div>
          <button className="commandButton selectAllPathsButton" onClick={selectAllDetectedPathSegments} disabled={geoOsmPathState !== "ready" || geoOsmForestPaths.length === 0 || geoSelectedOsmPathIds.length === geoOsmForestPaths.length} type="button">
            <MapPinned size={16} />
            {geoSelectedOsmPathIds.length === geoOsmForestPaths.length && geoOsmForestPaths.length > 0 ? `Alle ${geoOsmForestPaths.length} Wege ausgewählt` : `Alle erkannten Wege auswählen (${geoOsmForestPaths.length})`}
          </button>
          {geoSelectedOsmPathIds.length > 0 && <small className="pathSelectionHint">Ausgewählte Wege sind blau. Zum Abwählen den jeweiligen Weg auf der Karte anklicken.</small>}
          <button className="textButton" onClick={() => setDraftWaypoints(buildWaypoints(scenario.forestPath.waypoints))} disabled={selectedCustomerMission?.missionPath === null} title={selectedCustomerMission?.missionPath === null ? "Für neue Missionen muss ein eigener oder importierter Weg verwendet werden." : undefined}>
            Standardroute zum Bearbeiten laden
          </button>
          <button className="savePathButton" onClick={saveDraftPath} disabled={draftWaypoints.length < 2 || !selectedCustomerMission}>
            <Save size={16} />
            Weg speichern
          </button>
          <div className="pathSummary">
            <strong>{draftWaypoints.length}</strong>
            <small>{hasActiveMissionPath ? `${measuredCoverageCount.toLocaleString("de-DE")} Messfelder · Bewertung: ${routeAssessment}` : "Noch keine Streckenmetriken"}</small>
            <small>{hasActiveMissionPath ? `${formatRouteLength(activeRouteLengthMeters)} Strecke · ${activeMeasurementCorridorHectares.toFixed(2)} ha Messkorridor` : "Route auf der Karte markieren und speichern"}</small>
            <span>{!hasActiveMissionPath ? "Noch kein Missionspfad definiert" : "Missionspfad aktiv"}</span>
            <span>{geoSelectedOsmPathIds.length > 0 ? `${geoSelectedOsmPathIds.length} erkannte Wegabschnitte zur Gesamtfahrt kombiniert` : "Keine erkannten Wegabschnitte ausgewählt"}</span>
          </div>
          <div className="waypointList">
            {draftWaypoints.slice(-5).map((waypoint) => (
              <div key={waypoint.id} className="waypointRow">
                <strong>{waypoint.sequence}</strong>
                <span>
                  {waypoint.lat.toFixed(5)}, {waypoint.lng.toFixed(5)}
                </span>
              </div>
            ))}
          </div>
          {!selectedCustomerMission && <div className="savedPathList">
            {savedPaths.length === 0 ? (
              <span className="emptySavedPath">Noch keine gespeicherten Wege</span>
            ) : (
              savedPaths.map((path) => (
                <div key={path.id} className="savedPathRow">
                  <button className="savedPathLoad" onClick={() => loadSavedPath(path)}>
                    <FolderOpen size={15} />
                    <span>{path.name}</span>
                    <small>{path.waypoints.length} Punkte</small>
                  </button>
                  <button className="iconButton danger" aria-label={`${path.name} löschen`} title="Gespeicherten Weg löschen" onClick={() => deleteSavedPath(path.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>}
        </section>}

        <section className="panel compact">
          <PanelTitle icon={<ShieldCheck size={18} />} title="Governance" />
          <div className="statusGrid">
            <StatusPill label="Origin" value="synthetic" />
            <StatusPill label="Generator" value={scenario.generatorVersion} />
            <StatusPill label="Status" value="simulated / derived" />
            <StatusPill label="Freigabe" value="intern" />
          </div>
        </section>
      </aside>

      <main className="workspace">
        <div className="mapStage">
          <MapContainer key={mapKey} center={toLatLng(mapCenter)} zoom={15} minZoom={14} maxZoom={18} preferCanvas className="map">
            <MapClickCapture enabled={isAdmin && isPathCaptureEnabled} onPick={addDraftCoordinate} />
            <TileLayer
              key={baseMapId}
              attribution={activeBaseMap.attribution}
              url={activeBaseMap.url}
            />
            <Polygon
              positions={activeScenario.forestArea.polygon.map(toLatLng)}
              pathOptions={{
                color: baseMapId === "satellite" ? "#f8fafc" : "#334155",
                fillColor: forestDataDisplayMode === "average" && forestAverageValue !== null
                  ? colorForValue(forestAverageValue, activeLayer)
                  : baseMapId === "satellite" ? "#0f172a" : "#1f2937",
                fillOpacity: forestDataDisplayMode === "average" && forestAverageValue !== null ? 0.42 : baseMapId === "satellite" ? 0.1 : 0.18,
                weight: 2,
              }}
            >
              <Tooltip>{forestDataDisplayMode === "average" && forestAverageValue !== null
                ? `Abgeleiteter Routendurchschnitt: ${formatValue(forestAverageValue, activeLayer)} ${activeLayer.unit}`
                : activeScenario.forestArea.name}</Tooltip>
            </Polygon>
            {geoOsmForestPaths.map((path) => (
              <Polyline
                key={`geo-osm-path-${path.id}`}
                positions={path.coordinates.map(toLatLng)}
                bubblingMouseEvents={false}
                eventHandlers={{
                  mouseover: () => setGeoHoveredOsmPathId(path.id),
                  mouseout: () => setGeoHoveredOsmPathId(null),
                  click: () => {
                    if (!isAdmin || !selectedCustomerMission) return;
                    toggleDetectedPathSegment(path);
                  },
                }}
                pathOptions={{
                  color: geoSelectedOsmPathIds.includes(path.id) ? "#2563eb" : geoHoveredOsmPathId === path.id ? "#f59e0b" : "#0f766e",
                  weight: geoSelectedOsmPathIds.includes(path.id) ? 7 : geoHoveredOsmPathId === path.id ? 7 : 3.5,
                  opacity: 0.96,
                  renderer: geoOsmPathRenderer,
                }}
              >
                <Tooltip sticky>{path.name} · {isAdmin ? geoSelectedOsmPathIds.includes(path.id) ? "aus Gesamtfahrt entfernen" : "anklicken und zur Gesamtfahrt hinzufügen" : "erkannter Waldweg"}</Tooltip>
              </Polyline>
            ))}
            {hasActiveMissionPath && <Polyline
              positions={splitRouteAtBreaks(activeForestPath.waypoints).map((segment) => segment.map(toLatLng))}
              pathOptions={{ color: baseMapId === "satellite" ? "#ffffff" : "#64748b", weight: 16, opacity: baseMapId === "satellite" ? 0.16 : 0.2 }}
            />}
            {hasActiveMissionPath && <Polyline
              positions={splitRouteAtBreaks(activeForestPath.waypoints).map((segment) => segment.map(toLatLng))}
              pathOptions={{ color: draftWaypoints.length >= 2 ? "#f59e0b" : "#14b8a6", weight: 5, opacity: 0.95 }}
            />}
            {draftWaypoints.map((waypoint) => (
              <CircleMarker
                key={waypoint.id}
                center={[waypoint.lat, waypoint.lng]}
                radius={6}
                pathOptions={{ color: "#7c2d12", fillColor: "#f59e0b", fillOpacity: 1, weight: 2 }}
              >
                <Tooltip permanent={waypoint.sequence === 1 || waypoint.sequence === draftWaypoints.length} direction={waypoint.sequence === 1 ? "left" : "right"}>
                  {waypoint.sequence === 1 ? "Start" : waypoint.sequence === draftWaypoints.length ? "Ende" : `Wegpunkt ${waypoint.sequence}`}: {waypoint.lat.toFixed(5)}, {waypoint.lng.toFixed(5)}
                </Tooltip>
              </CircleMarker>
            ))}
            {hasActiveMissionPath && interpolatedForestHeatmap && <ImageOverlay
              url={interpolatedForestHeatmap.url}
              bounds={interpolatedForestHeatmap.bounds}
              opacity={layerOpacity}
              interactive={false}
            />}
            {hasActiveMissionPath && forestDataDisplayMode === "corridor" && coverage.map((cell) => (
              <Rectangle
                key={cell.id}
                bounds={cellBounds.get(cell.id) ?? [[cell.lat, cell.lng], [cell.lat, cell.lng]]}
                pathOptions={{
                  color: selectedCell?.id === cell.id ? "#111827" : cell.value === null ? "#52525b" : "#ffffff",
                  weight: selectedCell?.id === cell.id ? 2 : 0.5,
                  fillColor: colorForValue(cell.value, activeLayer, cell.confidence),
                  fillOpacity: cell.value === null ? layerOpacity * 0.44 : layerOpacity * (0.36 + cell.confidence * 0.54),
                }}
                eventHandlers={{
                  click: () => setSelectedCell(cell),
                }}
              >
                <Tooltip>
                  {activeLayer.name}: {cell.value === null ? "unbekannt" : `${formatValue(cell.value, activeLayer)} ${activeLayer.unit}`}
                  {cell.dataStatus === "interpolated" ? <><br />Interpoliert · nächster Messpunkt {Math.round(cell.distanceToRouteMeters)} m</> : null}
                </Tooltip>
              </Rectangle>
            ))}
            {hasActiveMissionPath && <CircleMarker
              center={[currentObservation.lat, currentObservation.lng]}
              radius={9}
              pathOptions={{ color: "#111827", fillColor: "#f97316", fillOpacity: 1, weight: 3 }}
            >
              <Tooltip permanent direction="top">
                UGV
              </Tooltip>
            </CircleMarker>}
          </MapContainer>

          <div className="mapOverlay forestDetailBaseMaps missionBaseMapControl" aria-label="Basiskarte">
            {(["street", "topo", "satellite"] as BaseMapId[]).map((mapId) => (
              <button key={mapId} className={baseMapId === mapId ? "active" : ""} onClick={() => setBaseMapId(mapId)} type="button">
                {mapId === "street" ? "Karte" : mapId === "topo" ? "Topo" : "Satellit"}
              </button>
            ))}
          </div>
          <div className="mapOverlay forestAverageMapToggle">
            <label>Datendarstellung
              <select value={forestDataDisplayMode} onChange={(event) => setForestDataDisplayMode(event.target.value as "corridor" | "surface" | "average")} disabled={!hasActiveMissionPath}>
                <option value="corridor">Nur gemessener Korridor</option>
                <option value="surface">Gesamter Wald · stetige Heatmap</option>
                <option value="average">Gesamter Wald · Routendurchschnitt</option>
              </select>
            </label>
            {forestDataDisplayMode === "surface" && <>
              <label>Interpolationsmodus
                <select value={heatmapInterpolationMode} onChange={(event) => setHeatmapInterpolationMode(event.target.value as "full" | "confidence")}>
                  <option value="full">Vollständig · Confidence-Abblendung</option>
                  <option value="confidence">Confidence-begrenzt</option>
                </select>
              </label>
              {heatmapInterpolationMode === "confidence" && <>
                <label>Max. Distanz: {heatmapMaxDistanceMeters} m<input type="range" min={10} max={100} step={5} value={heatmapMaxDistanceMeters} onChange={(event) => setHeatmapMaxDistanceMeters(Number(event.target.value))} /></label>
                <label>Min. Confidence: {Math.round(heatmapMinConfidence * 100)} %<input type="range" min={0} max={1} step={0.05} value={heatmapMinConfidence} onChange={(event) => setHeatmapMinConfidence(Number(event.target.value))} /></label>
              </>}
            </>}
            <small>{forestDataDisplayMode === "surface" ? isHeatmapUpdatePending ? "Werte geändert · Heatmap wird nach 1 Sekunde Ruhe aktualisiert …" : "IDW-Interpolation aus den sechs nächsten Messpunkten; modelliert außerhalb der Route." : forestDataDisplayMode === "average" ? "Ein abgeleiteter Mittelwert für das ganze Polygon." : "Mess- und schmale Interpolationsfläche entlang der Route."}</small>
          </div>

          <div className="mapOverlay topLeft">
            <strong>{activeScenario.forestArea.name}</strong>
            <span>
              {activeScenario.forestArea.hectares} ha · {mission.vehicle} · {mission.durationMinutes} min
            </span>
            <span>
              {hasActiveMissionPath ? `${activeForestPath.name} · ${activeForestPath.waypoints.length} Wegpunkte · ${formatRouteLength(activeRouteLengthMeters)}` : "Noch kein Missionspfad definiert"}
            </span>
            <span>
              {geoOsmPathState === "loading" ? `${geoOsmPathStatus?.message ?? "Erkannte Waldwege werden geladen …"} ${geoOsmPathProgress}%` : geoOsmPathState === "error" ? geoOsmPathStatus?.message ?? "OSM-Wegenetz derzeit nicht verfügbar" : `${geoOsmForestPaths.length} erkannte OSM-Waldwege · ${formatOsmSource(geoOsmPathStatus?.source)}`}
            </span>
            {geoOsmPathState === "loading" && <progress className="geoPathLoadProgress" max={100} value={geoOsmPathProgress}>{geoOsmPathProgress}%</progress>}
            {geoOsmPathState === "error" && <button className="textButton" type="button" onClick={() => setGeoOsmReloadKey((value) => value + 1)}>Wegenetz erneut laden</button>}
            <span>
              {measuredCoverageCount.toLocaleString("de-DE")} Messfelder · Bewertung: {routeAssessment}
            </span>
          </div>

          {isAdmin && <div className={`mapOverlay pathCaptureControl ${isPathCaptureEnabled ? "active" : ""}`}>
            <button className="commandButton primary" onClick={() => setIsPathCaptureEnabled((enabled) => !enabled)} type="button">
              <MapPinned size={16} />
              {isPathCaptureEnabled ? "Markierung beenden" : "Weg markieren"}
            </button>
            <span>
              {draftWaypoints.length === 0
                ? "Erster Klick setzt den Startpunkt"
                : isPathCaptureEnabled
                  ? "Weitere Klicks ergänzen den Weg; der letzte Punkt ist das Ende"
                  : `${draftWaypoints.length} Punkte · Start und Ende markiert`}
            </span>
            {draftWaypoints.length > 0 && (
              <button className="textButton" onClick={() => { setDraftWaypoints([]); setGeoSelectedOsmPathIds([]); setGeoOsmBaseRoute([]); setIsPathCaptureEnabled(true); }} type="button">
                Weg neu markieren
              </button>
            )}
          </div>}

          {isAdmin && selectedCustomerMission && <button className={`mapOverlay missionSaveFloatingButton ${missionSaveState}`} onClick={() => void saveCurrentMission()} disabled={missionSaveState === "saving"} type="button">
            <Save size={16} />
            {missionSaveState === "saving" ? "Mission wird gespeichert …" : missionSaveState === "saved" ? "Mission gespeichert" : missionSaveState === "error" ? "Speichern fehlgeschlagen · erneut versuchen" : "Mission speichern"}
          </button>}

          <button className="mapOverlay overviewOpenButton" onClick={() => setIsMissionOverviewOpen(true)} type="button">
            <ClipboardList size={16} />
            Missionsüberblick
          </button>

          <div className="mapOverlay legend">
            <span className="legendTitle">{activeLayer.name}</span>
            <div className="legendBar" style={{ background: `linear-gradient(90deg, ${activeLayer.palette.join(", ")})` }} />
            <div className="legendScale">
              <span>{activeLayer.min}</span>
              <span>{activeLayer.max} {activeLayer.unit}</span>
            </div>
            <div className="legendUnknown">
              <span className="unknownSwatch" />
              <span>{forestDataDisplayMode === "surface" && heatmapInterpolationMode === "full" ? "Modelliert · Transparenz zeigt sinkende Confidence" : "Unbekannt / außerhalb Confidence-Grenze"}</span>
            </div>
          </div>
        </div>

        <section className="playbackBar">
          <button className="primaryIconButton" disabled={!hasActiveMissionPath} onClick={() => setIsPlaying((playing) => !playing)} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div className="timelineBlock">
            <div className="timelineMeta">
              <span>Minute {Math.round(currentObservation.minute)}</span>
              <span>{new Date(currentObservation.timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <input
              className="timeline"
              type="range"
              min={0}
              max={observations.length - 1}
              value={currentIndex}
              onChange={(event) => {
                setCurrentIndex(Number(event.target.value));
                setIsPlaying(false);
              }}
            />
          </div>
        </section>
      </main>

      <aside className="inspector">
        <section className="panel">
          <PanelTitle icon={<Satellite size={18} />} title="Live-Wetter" />
          <div className={`weatherCard compact ${liveWeather.fireWeatherHint}`}>
            <span>{weatherStatus === "live" ? "Open-Meteo live" : weatherStatus === "loading" ? "Wird geladen" : "Fallback"}</span>
            <strong>{liveWeather.temperature.toFixed(1)} °C · {liveWeather.humidity}% RH</strong>
            <small>
              {describeWeatherCode(liveWeather.weatherCode)} · Wind {Math.round(liveWeather.windSpeed)} km/h · Böen {Math.round(liveWeather.windGusts)} km/h
            </small>
            <em>Brandwetter: {liveWeather.fireWeatherHint}</em>
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={<Activity size={18} />} title="Inspector" />
          <MetricGrid observation={selectedObservation} activeLayerId={activeLayerId} selectedCell={selectedCell} />
          {isCopernicusLayer ? (
            <div className="copernicusInspectorNote">
              <strong>{copernicusAnalysis.scene.collection}</strong>
              <span>
                {copernicusAnalysis.vegetationLabel}; {copernicusAnalysis.moistureLabel}
              </span>
            </div>
          ) : null}
          <button className="inspectorOverviewButton" onClick={() => setIsMissionOverviewOpen(true)} type="button">
            <ClipboardList size={16} />
            Zustandsüberblick öffnen
          </button>
        </section>

        <section className="panel chartPanel">
          <PanelTitle icon={<BarChart3 size={18} />} title="Zeitverlauf" />
          <ResponsiveContainer width="100%" height={178}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="temperatureFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="minute" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={Math.round(currentObservation.minute)} stroke="#111827" strokeWidth={2} />
              <Area type="monotone" dataKey="temperature" name="Temp" stroke="#ef4444" fill="url(#temperatureFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="dryStress" name="Stress" stroke="#f59e0b" fill="url(#stressFill)" strokeWidth={2} yAxisId={0} />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <PanelTitle icon={<Flame size={18} />} title="Waldbrandmonitor" />
          <UseCaseRow label="Screening-Zonen" value={`${highRiskCount}`} tone={highRiskCount > 24 ? "danger" : "warn"} />
          <UseCaseRow label="Messluecken" value={`${lowConfidenceCount}`} tone="neutral" />
          <UseCaseRow label="Live-Wetter" value={liveWeather.fireWeatherHint} tone={liveWeather.fireWeatherHint === "erhoeht" ? "danger" : liveWeather.fireWeatherHint === "beobachten" ? "warn" : "neutral"} />
          <p className="notice">
            Screeningwert; kein alleiniger Alarmgeber. Validierte Wetter-, Brennstoff- und Eskalationsdaten bleiben erfürderlich.
          </p>
        </section>

        <section className="panel">
          <PanelTitle icon={<Sprout size={18} />} title="Aufforstungsmonitor" />
          <div className="phaseList">
            <Phase label="Baseline" value="gesetzt" />
            <Phase label="Frühphase" value="Trockenstress lokal" />
            <Phase label="Etablierung" value="ausstehend" />
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={<Eye size={18} />} title="Bürgermonitor" />
          <div className="publicPreview">
            <AlertTriangle size={16} />
            <span>Freigegebener Hinweis: erhöhte Trockenheit in Teilbereichen, Wege nutzbar.</span>
          </div>
        </section>
      </aside>
    </div>
  );
}

function IndexBuilderPage({
  initialValues,
  definitions,
  allDefinitions,
  displaySettings,
  onSaveCustomIndex,
  onUpdateDisplaySetting,
  onSetAllIndexVisibility,
  onBackToPortal,
  onOpenGeo,
}: {
  initialValues: IndexBuilderValues;
  definitions: IndexDefinitionDemo[];
  allDefinitions: IndexDefinitionDemo[];
  displaySettings: IndexDisplaySetting[];
  onSaveCustomIndex: (definition: CustomIndexDefinition) => void;
  onUpdateDisplaySetting: (indexCode: string, patch: Partial<IndexDisplaySetting>) => void;
  onSetAllIndexVisibility: (visible: boolean) => void;
  onBackToPortal: () => void;
  onOpenGeo: () => void;
}) {
  const [values, setValues] = useState<IndexBuilderValues>(initialValues);
  const availableInputs = useMemo(() => buildAvailableIndexInputs(values), [values]);
  const [draftName, setDraftName] = useState("Neuer kommunaler Waldindex");
  const [draftQuestion, setDraftQuestion] = useState("Welche fachliche Lage soll dieser Index als Screening sichtbar machen?");
  const [higherIsWorse, setHigherIsWorse] = useState(true);
  const [selectedInputIds, setSelectedInputIds] = useState<string[]>(["temperature", "humidity", "dryStress", "speciesRichness", "ndvi"]);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const normalizedWeights = normalizeWeights(values.climateWeight, values.biodiversityWeight, values.satelliteWeight);
  const climateScore = calculateClimateIndex(values);
  const biodiversityScore = calculateBiodiversityIndex(values);
  const satelliteScore = calculateSatelliteIndex(values);
  const combinedScore = Math.round(climateScore * normalizedWeights.climate + biodiversityScore * normalizedWeights.biodiversity + satelliteScore * normalizedWeights.satellite);
  const resultTone = combinedScore >= 70 ? "risk" : combinedScore >= 42 ? "watch" : "good";

  const updateValue = (key: keyof IndexBuilderValues, value: number) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const toggleInput = (inputId: string) => {
    setSelectedInputIds((current) => (current.includes(inputId) ? current.filter((id) => id !== inputId) : [...current, inputId]));
    setSaveState("idle");
  };

  const saveDraftIndex = () => {
    const selectedInputs = availableInputs.filter((input) => selectedInputIds.includes(input.id));
    const code = `${slugify(draftName || "custom-index").replace(/-/g, "_").toUpperCase()}_V1`;
    onSaveCustomIndex({
      indexCode: code,
      name: draftName.trim() || "Neuer kommunaler Waldindex",
      status: "EXPERIMENTAL",
      version: "1.0.0",
      output: `0-100, ${higherIsWorse ? "hoeher schlechter" : "hoeher besser"}`,
      inputs: selectedInputs.map((input) => `${input.label}: ${input.value}`),
      missingPolicy: "FAIL_IF_COVERAGE_BELOW 0.70",
      confidenceRule: "manuell definierte Preview; Provenienz aus sichtbaren Missionswerten",
      interpretationLimit: draftQuestion.trim() || "Experimenteller Index ohne fachliche Validierung",
      createdAt: new Date().toISOString(),
      selectedInputIds,
    });
    setSaveState("saved");
  };

  return (
    <div className="indexBuilderShell">
      <header className="indexBuilderHeader">
        <button className="backButton" onClick={onBackToPortal} type="button">
          <ArrowLeft size={18} />
          Portal
        </button>
        <div>
          <p className="eyebrow">Project Athene</p>
          <h1>Index Builder</h1>
          <p className="recordSubline">Manuelle Vorschau für sichtbare Missions-, Arten-, Wetter- und Satellitenwerte</p>
        </div>
        <button className="recordExportButton" onClick={onOpenGeo} type="button">
          <MapPinned size={17} />
          GeoID
        </button>
      </header>

      <main className="indexBuilderContent">
        <section className={`indexResultHero ${resultTone}`}>
          <div>
            <p className="eyebrow">Preview Ergebnis</p>
            <h2>{combinedScore}/100</h2>
            <p>
              Kombinierter Demo-Index aus Klima, Artenmetriken und Satellitenkontext. Alle Werte sind manuell editierbar; die Formel bleibt als experimentelle Vorschau gekennzeichnet.
            </p>
          </div>
          <div className="indexScoreBreakdown">
            <OverviewMetric label="Klima" value={`${climateScore}`} detail={`${Math.round(normalizedWeights.climate * 100)}% Gewicht`} />
            <OverviewMetric label="Biodiversität" value={`${biodiversityScore}`} detail={`${Math.round(normalizedWeights.biodiversity * 100)}% Gewicht`} />
            <OverviewMetric label="Satellit" value={`${satelliteScore}`} detail={`${Math.round(normalizedWeights.satellite * 100)}% Gewicht`} />
          </div>
        </section>

        <section className="indexBuilderGrid">
          <div className="indexInputPanel wide">
            <PanelTitle icon={<Save size={18} />} title="Index neu anlegen" />
            <label className="builderTextInput">
              <span>Name</span>
              <input value={draftName} onChange={(event) => { setDraftName(event.target.value); setSaveState("idle"); }} />
            </label>
            <label className="builderTextInput">
              <span>Fragestellung / Beschreibung</span>
              <textarea value={draftQuestion} onChange={(event) => { setDraftQuestion(event.target.value); setSaveState("idle"); }} rows={3} />
            </label>
            <label className="builderCheckbox">
              <input type="checkbox" checked={higherIsWorse} onChange={(event) => { setHigherIsWorse(event.target.checked); setSaveState("idle"); }} />
              <span>Höherer Wert bedeutet schlechtere Lage</span>
            </label>
            <button className="recordSaveButton" onClick={saveDraftIndex} type="button">
              <Save size={17} />
              {saveState === "saved" ? "Index gespeichert" : "Index speichern"}
            </button>
          </div>

          <div className="indexInputPanel wide">
            <PanelTitle icon={<Layers size={18} />} title="Verfügbare Daten" />
            <div className="availableInputList">
              {availableInputs.map((input) => (
                <label key={input.id} className={`availableInputRow ${selectedInputIds.includes(input.id) ? "active" : ""}`}>
                  <input type="checkbox" checked={selectedInputIds.includes(input.id)} onChange={() => toggleInput(input.id)} />
                  <span>
                    <strong>{input.label}</strong>
                    <small>{input.group} · {input.value}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="indexInputPanel wide">
            <PanelTitle icon={<ClipboardList size={18} />} title="Gespeicherte Indizes" />
            <div className="indexDefinitionList">
              {definitions.map((definition) => (
                <div key={definition.indexCode} className="indexDefinitionRow">
                  <div>
                    <strong>{definition.name}</strong>
                    <span>{definition.indexCode} · v{definition.version} · {definition.status}</span>
                  </div>
                  <small>{definition.output}</small>
                  <p>{definition.interpretationLimit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="indexInputPanel">
          <div className="indexDisplayHeader">
            <PanelTitle icon={<Eye size={18} />} title="Anzeige anpassen" />
            <div className="indexDisplayActions">
              <button className="commandButton" onClick={() => onSetAllIndexVisibility(true)} type="button">Alle zeigen</button>
              <button className="commandButton" onClick={() => onSetAllIndexVisibility(false)} type="button">Alle ausblenden</button>
            </div>
          </div>
          <div className="indexDisplayList">
            {allDefinitions.map((definition) => {
              const setting = getIndexDisplaySetting(displaySettings, definition.indexCode);
              return (
                <div key={definition.indexCode} className={`indexDisplayRow ${setting.visible ? "visible" : ""}`}>
                  <label className="builderCheckbox">
                    <input type="checkbox" checked={setting.visible} onChange={(event) => onUpdateDisplaySetting(definition.indexCode, { visible: event.target.checked })} />
                    <span>{definition.name}</span>
                  </label>
                  <label className="builderCheckbox">
                    <input type="checkbox" checked={setting.favorite} onChange={(event) => onUpdateDisplaySetting(definition.indexCode, { favorite: event.target.checked })} />
                    <span>Favorit</span>
                  </label>
                  <label className="builderSelect">
                    <span>Kanal</span>
                    <select value={setting.channel} onChange={(event) => onUpdateDisplaySetting(definition.indexCode, { channel: event.target.value as IndexDisplaySetting["channel"] })}>
                      <option>Admin</option>
                      <option>Partner</option>
                      <option>Bürger</option>
                    </select>
                  </label>
                  <label className="builderSelect">
                    <span>Anzeige</span>
                    <select value={setting.displayMode} onChange={(event) => onUpdateDisplaySetting(definition.indexCode, { displayMode: event.target.value as IndexDisplaySetting["displayMode"] })}>
                      <option>Kachel</option>
                      <option>Kompakt</option>
                      <option>Detail</option>
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <section className="indexBuilderGrid">
          <div className="indexInputPanel">
            <PanelTitle icon={<Flame size={18} />} title="Klima und Stress" />
            <NumberInput label="Temperatur" unit="°C" min={-5} max={45} step={0.1} value={values.temperature} onChange={(value) => updateValue("temperature", value)} />
            <NumberInput label="Luftfeuchte" unit="%" min={0} max={100} step={1} value={values.humidity} onChange={(value) => updateValue("humidity", value)} />
            <NumberInput label="Trockenstress" unit="0-1" min={0} max={1} step={0.01} value={values.dryStress} onChange={(value) => updateValue("dryStress", value)} />
            <NumberInput label="Confidence" unit="0-1" min={0} max={1} step={0.01} value={values.confidence} onChange={(value) => updateValue("confidence", value)} />
          </div>

          <div className="indexInputPanel">
            <PanelTitle icon={<Sprout size={18} />} title="Artenmetriken" />
            <NumberInput label="Species Richness" unit="Taxa" min={0} max={40} step={1} value={values.speciesRichness} onChange={(value) => updateValue("speciesRichness", value)} />
            <NumberInput label="Shannon" unit="H" min={0} max={4} step={0.01} value={values.shannon} onChange={(value) => updateValue("shannon", value)} />
            <NumberInput label="Audioaktivität" unit="Events/h" min={0} max={80} step={0.1} value={values.acousticActivityRate} onChange={(value) => updateValue("acousticActivityRate", value)} />
            <NumberInput label="Native Plant Share" unit="0-1" min={0} max={1} step={0.01} value={values.nativePlantShare} onChange={(value) => updateValue("nativePlantShare", value)} />
          </div>

          <div className="indexInputPanel">
            <PanelTitle icon={<Satellite size={18} />} title="Satellit und Gewichte" />
            <NumberInput label="NDVI" unit="Index" min={0} max={1} step={0.01} value={values.ndvi} onChange={(value) => updateValue("ndvi", value)} />
            <NumberInput label="NDMI" unit="Index" min={-0.4} max={0.7} step={0.01} value={values.ndmi} onChange={(value) => updateValue("ndmi", value)} />
            <NumberInput label="NBR" unit="Index" min={-0.2} max={0.9} step={0.01} value={values.nbr} onChange={(value) => updateValue("nbr", value)} />
            <NumberInput label="Klima Gewicht" unit="" min={0} max={1} step={0.01} value={values.climateWeight} onChange={(value) => updateValue("climateWeight", value)} />
            <NumberInput label="Biodiversität Gewicht" unit="" min={0} max={1} step={0.01} value={values.biodiversityWeight} onChange={(value) => updateValue("biodiversityWeight", value)} />
            <NumberInput label="Satellit Gewicht" unit="" min={0} max={1} step={0.01} value={values.satelliteWeight} onChange={(value) => updateValue("satelliteWeight", value)} />
          </div>
        </section>

        <section className="indexBuilderGrid">
          <div className="indexInputPanel wide">
            <PanelTitle icon={<ShieldCheck size={18} />} title="Validierung" />
            <div className="validationList">
              <ValidationRow label="Missing Policy" value="FAIL_IF_COVERAGE_BELOW 0.70" ok={values.confidence >= 0.7} />
              <ValidationRow label="Semantische Typprüfung" value="normalisierte Werte vor Gewichtung" ok />
              <ValidationRow label="Freigabestatus" value="EXPERIMENTAL" ok={false} />
              <ValidationRow label="Provenienz" value="Mission, Wetter, Copernicus, Taxonquelle, Formelversion" ok />
            </div>
          </div>

          <div className="indexInputPanel wide">
            <PanelTitle icon={<BarChart3 size={18} />} title="Index-Definitionen" />
            <div className="indexDefinitionList">
              {definitions.map((definition) => (
                <div key={definition.indexCode} className="indexDefinitionRow">
                  <div>
                    <strong>{definition.name}</strong>
                    <span>{definition.indexCode} · v{definition.version} · {definition.status}</span>
                  </div>
                  <small>{definition.output}</small>
                  <p>{definition.interpretationLimit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function HyperionPage({
  municipalities,
  areas,
  items,
  selectedMunicipalityId,
  onSelectMunicipality,
  onBackToPortal,
  onOpenArea,
  onOpenIndexBuilder,
}: {
  municipalities: Municipality[];
  areas: DeploymentArea[];
  items: HyperionMapItem[];
  selectedMunicipalityId: string;
  onSelectMunicipality: (municipalityId: string) => void;
  onBackToPortal: () => void;
  onOpenArea: (areaId: string) => void;
  onOpenIndexBuilder: () => void;
}) {
  const selectedMunicipality = municipalities.find((item) => item.id === selectedMunicipalityId) ?? municipalities[0];
  const visibleItems = items.filter((item) => item.municipalityId === selectedMunicipality.id);
  const [selectedItemId, setSelectedItemId] = useState(visibleItems[0]?.id ?? "");
  const selectedItem = visibleItems.find((item) => item.id === selectedItemId) ?? visibleItems[0];
  const selectedArea = selectedItem
    ? areas.find((area) => area.municipalityId === selectedMunicipality.id && area.name === selectedItem.areaName && area.status !== "archiviert") ?? null
    : null;

  useEffect(() => {
    setSelectedItemId(visibleItems[0]?.id ?? "");
  }, [selectedMunicipalityId]);

  return (
    <div className="hyperionShell">
      <header className="indexBuilderHeader">
        <button className="backButton" onClick={onBackToPortal} type="button">
          <ArrowLeft size={18} />
          Portal
        </button>
        <div>
          <p className="eyebrow">Hyperion</p>
          <h1>Kartenakte</h1>
          <p className="recordSubline">Tools, Dateien, Reports und Layer pro Gemeinde und Einsatzgebiet</p>
        </div>
        <button className="recordExportButton" onClick={() => { if (selectedArea) onOpenArea(selectedArea.id); }} disabled={!selectedArea} type="button">
          <MapPinned size={17} />
          GeoID
        </button>
        <button className="recordExportButton" onClick={onOpenIndexBuilder} type="button">
          <BarChart3 size={17} />
          Index Builder
        </button>
      </header>

      <main className="hyperionLayout">
        <aside className="hyperionSidebar">
          <PanelTitle icon={<Building2 size={18} />} title="Kreis / Gemeinde" />
          <label className="fieldLabel">
            Verwaltungseinheit
            <select value={selectedMunicipalityId} onChange={(event) => onSelectMunicipality(event.target.value)}>
              {municipalities.map((municipality) => (
                <option key={municipality.id} value={municipality.id}>
                  {municipality.name}
                </option>
              ))}
            </select>
          </label>
          <div className="hyperionItemList">
            {visibleItems.map((item) => (
              <button key={item.id} className={`hyperionItemButton ${selectedItem?.id === item.id ? "active" : ""}`} onClick={() => setSelectedItemId(item.id)} type="button">
                {iconForHyperionType(item.type)}
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.type} · {item.areaName}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="hyperionMapPanel">
          <MapContainer center={[selectedMunicipality.center.lat, selectedMunicipality.center.lng]} zoom={13} minZoom={11} maxZoom={18} className="hyperionMap" key={selectedMunicipality.id}>
            <TileLayer attribution={baseMaps.street.attribution} url={baseMaps.street.url} />
            {visibleItems.map((item) => (
              <CircleMarker
                key={item.id}
                center={[item.coordinate.lat, item.coordinate.lng]}
                radius={selectedItem?.id === item.id ? 11 : 8}
                pathOptions={{
                  color: selectedItem?.id === item.id ? "#111827" : "#ffffff",
                  fillColor: colorForHyperionType(item.type),
                  fillOpacity: 0.92,
                  weight: selectedItem?.id === item.id ? 3 : 1,
                }}
                eventHandlers={{ click: () => setSelectedItemId(item.id) }}
              >
                <Tooltip>
                  {item.title} · {item.type}
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </section>

        <aside className="hyperionInspector">
          {selectedItem ? (
            <>
              <div className={`hyperionTypePill ${selectedItem.type}`}>{selectedItem.type}</div>
              <h2>{selectedItem.title}</h2>
              <p>{selectedItem.description}</p>
              <div className="hyperionMetaGrid">
                <Metric label="Gebiet" value={selectedItem.areaName} />
                <Metric label="Owner" value={selectedItem.owner} />
                <Metric label="Status" value={selectedItem.status} />
                <Metric label="Update" value={new Date(selectedItem.updatedAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })} />
              </div>
              <div className="hyperionPayload">
                {selectedItem.payload.map((row) => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
              <button className="inspectorOverviewButton" onClick={() => selectedItem.type === "tool" ? onOpenIndexBuilder() : selectedArea && onOpenArea(selectedArea.id)} disabled={selectedItem.type !== "tool" && !selectedArea} type="button">
                {selectedItem.type === "tool" ? <BarChart3 size={16} /> : <MapPinned size={16} />}
                {selectedItem.type === "tool" ? "Tool öffnen" : "In GeoID anzeigen"}
              </button>
            </>
          ) : (
            <p className="emptyRecordHistory">Keine Hyperion-Objekte für diese Verwaltungseinheit.</p>
          )}
        </aside>
      </main>
    </div>
  );
}

function AdminMapViewport({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();

  useEffect(() => {
    const fit = () => {
      if (!bounds) {
        map.setView([48.78, 9.16], 8, { animate: true });
        return;
      }
      const size = map.getSize();
      map.fitBounds(bounds, {
        paddingTopLeft: [Math.round(size.x * 0.08), Math.round(size.y * 0.1)],
        paddingBottomRight: [Math.round(size.x * 0.08), Math.round(size.y * 0.1)],
        animate: true,
        maxZoom: 15,
      });
    };
    fit();
    map.on("resize", fit);
    return () => { map.off("resize", fit); };
  }, [bounds, map]);

  return null;
}

function ForestAreaViewport({ bounds, focusKey }: { bounds: [[number, number], [number, number]]; focusKey: string }) {
  const map = useMap();
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  useEffect(() => {
    const bounds = boundsRef.current;
    const [[south, west], [north, east]] = bounds;
    const latPadding = Math.max((north - south) * 0.35, 0.0012);
    const lngPadding = Math.max((east - west) * 0.35, 0.0012);
    const paddedBounds: [[number, number], [number, number]] = [
      [south - latPadding, west - lngPadding],
      [north + latPadding, east + lngPadding],
    ];
    map.setMaxBounds(paddedBounds);
    map.fitBounds(bounds, { padding: [56, 56], animate: false });
    map.setMinZoom(Math.max(12, map.getZoom() - 1));
  }, [focusKey, map]);

  return null;
}

function ForestDrawingCapture({ enabled, onPick }: { enabled: boolean; onPick: (coordinate: Coordinate) => void }) {
  useMapEvents({
    click(event) {
      if (!enabled) return;
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);
  return debouncedValue;
}

function formatOsmSource(source: OsmLoadProgress["source"] | undefined): string {
  if (source === "memory-cache") return "RAM-Cache";
  if (source === "browser-cache") return "Browser-Cache";
  if (source === "athene-proxy") return "Athene-Proxy";
  if (source === "external-fallback") return "OSM-Fallback";
  return "geladen";
}

function BadenWuerttembergMapPage({
  canManage,
  municipalities,
  missions,
  missionRecords,
  forestAreas,
  selectedAreaId,
  focusAreaId,
  focusMunicipalityId,
  initialDetailAreaId,
  initialBaseMapId,
  selectedMunicipalityId,
  onSelectArea,
  onSelectMunicipalityContext,
  onClearAreaFocus,
  onSaveArea,
  onPlanForestMission,
  onDetailAreaChange,
  onBaseMapChange,
  onOpenRealMissionUpload,
  onOpenMockMission,
  onOpenMission,
  onDeleteMission,
  onArchiveMission,
  onArchiveArea,
  feedback,
  onBackToPortal,
  onOpenGeo,
}: {
  canManage: boolean;
  municipalities: Municipality[];
  missions: CustomerMissionTemplate[];
  missionRecords: MissionRecord[];
  forestAreas: DeploymentArea[];
  selectedAreaId: string;
  focusAreaId: string | null;
  focusMunicipalityId: string | null;
  initialDetailAreaId: string | null;
  initialBaseMapId: BaseMapId;
  selectedMunicipalityId: string;
  onSelectArea: (areaId: string, preserveViewport?: boolean) => void;
  onSelectMunicipalityContext: (municipalityId: string | null) => void;
  onClearAreaFocus: () => void;
  onSaveArea: (area: DeploymentArea) => Promise<void>;
  onPlanForestMission: (areaId: string, values: { title: string; objective: string; priority: PlannedMissionRecord["priority"]; route: Coordinate[]; dataMode?: "real" | "mock"; allowEmptyRoute?: boolean; requestedAt?: string }) => Promise<void>;
  onDetailAreaChange: (areaId: string | null) => void;
  onBaseMapChange: (baseMapId: BaseMapId) => void;
  onOpenRealMissionUpload: (areaId: string, route: Coordinate[]) => void;
  onOpenMockMission: (areaId: string, route: Coordinate[]) => void;
  onOpenMission: (mission: CustomerMissionTemplate) => void;
  onDeleteMission: (missionId: string) => Promise<void>;
  onArchiveMission: (missionId: string) => Promise<void>;
  onArchiveArea: (areaId: string) => Promise<void>;
  feedback: { tone: "success" | "error" | "loading"; message: string } | null;
  onBackToPortal: () => void;
  onOpenGeo: () => void;
}) {
  const [districts, setDistricts] = useState<DistrictFeatureCollection | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [isDistrictFocusMode, setIsDistrictFocusMode] = useState(Boolean(focusAreaId || focusMunicipalityId));
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [gemeinden, setGemeinden] = useState<GemeindeFeatureCollection | null>(null);
  const [selectedGemeindeId, setSelectedGemeindeId] = useState<string | null>(null);
  const [gemeindenLoadState, setGemeindenLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [isForestDrawingEnabled, setIsForestDrawingEnabled] = useState(false);
  const [draftForestName, setDraftForestName] = useState("Waldgebiet");
  const [draftForestPolygon, setDraftForestPolygon] = useState<Coordinate[]>([]);
  const [editingMapAreaId, setEditingMapAreaId] = useState<string | null>(null);
  const [adminBaseMapId, setAdminBaseMapId] = useState<BaseMapId>(initialBaseMapId);
  const [showDistrictBoundaries, setShowDistrictBoundaries] = useState(true);
  const [showMunicipalityBoundaries, setShowMunicipalityBoundaries] = useState(true);
  const [showForestBoundaries, setShowForestBoundaries] = useState(true);
  const [showForestAverages, setShowForestAverages] = useState(false);
  const [forestAveragePeriodMode, setForestAveragePeriodMode] = useState<"month" | "quarter">("month");
  const [selectedForestAveragePeriod, setSelectedForestAveragePeriod] = useState("");
  const selectedManagedArea = forestAreas.find((area) => area.id === selectedAreaId) ?? null;
  const focusedManagedArea = forestAreas.find((area) => area.id === focusAreaId) ?? null;
  const [drawingMunicipalityId, setDrawingMunicipalityId] = useState(forestAreas.find((area) => area.id === focusAreaId)?.municipalityId ?? "");
  const [mapManagementError, setMapManagementError] = useState<string | null>(null);
  const [detailAreaId, setDetailAreaId] = useState<string | null>(initialDetailAreaId);
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);
  const [detailHeatmapLayerId, setDetailHeatmapLayerId] = useState<LayerId>("dryStress");
  const [detailHeatmapMode, setDetailHeatmapMode] = useState<"full" | "confidence">("full");
  const [detailHeatmapMaxDistance, setDetailHeatmapMaxDistance] = useState(30);
  const [detailHeatmapMinConfidence, setDetailHeatmapMinConfidence] = useState(0.45);
  const [timelineFrom, setTimelineFrom] = useState("");
  const [timelineTo, setTimelineTo] = useState("");
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [isMissionPlannerOpen, setIsMissionPlannerOpen] = useState(false);
  const [isMissionTypeChoiceOpen, setIsMissionTypeChoiceOpen] = useState(false);
  const [missionTitle, setMissionTitle] = useState("Waldmission");
  const [missionObjective, setMissionObjective] = useState("Zustandserfassung und Kontrollgang");
  const [missionPriority, setMissionPriority] = useState<PlannedMissionRecord["priority"]>("normal");
  const [missionDate, setMissionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [missionRoute, setMissionRoute] = useState<Coordinate[]>([]);
  const [missionPlannerFeedback, setMissionPlannerFeedback] = useState<string | null>(null);
  const [osmForestPaths, setOsmForestPaths] = useState<OsmForestPath[]>([]);
  const [osmPathState, setOsmPathState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [osmPathProgress, setOsmPathProgress] = useState(0);
  const [osmPathStatus, setOsmPathStatus] = useState<OsmLoadProgress | null>(null);
  const [osmReloadKey, setOsmReloadKey] = useState(0);
  const [hoveredOsmPathId, setHoveredOsmPathId] = useState<number | null>(null);
  const detailOsmPathRenderer = useMemo(() => createLeafletCanvas({ padding: 0.5, tolerance: 12 }), []);

  useEffect(() => {
    if (canManage) return;
    setIsForestDrawingEnabled(false);
    setIsMissionPlannerOpen(false);
    setIsMissionTypeChoiceOpen(false);
    setMissionRoute([]);
  }, [canManage]);
  const selectedDistrict = districts?.features.find((feature) => feature.properties.ID_3 === selectedDistrictId) ?? null;
  const selectedGemeinde = gemeinden?.features.find((feature) => feature.properties.gemeinde_id === selectedGemeindeId) ?? null;
  const currentForestScope = selectedGemeinde
    ? { id: `gemeinde-${selectedGemeinde.properties.gemeinde_id}`, name: selectedGemeinde.properties.gemeinde_name }
    : selectedDistrict && isDistrictFocusMode
      ? { id: `kreis-${selectedDistrict.properties.ID_3}`, name: selectedDistrict.properties.NAME_3 }
      : { id: "baden-wuerttemberg", name: "Baden-Württemberg" };
  const visibleForestAreas = forestAreas.filter((area) => area.status !== "archiviert" && (
    area.scopeId === currentForestScope.id
    || area.id === focusAreaId
    || Boolean(selectedDistrict && isDistrictFocusMode && geometryContainsCoordinate(selectedDistrict.geometry, centroidOf(area.polygon)))
  ));
  const visibleDistricts = useMemo<DistrictFeatureCollection | null>(() => {
    if (!districts) return null;
    if (!isDistrictFocusMode || !selectedDistrict) return districts;
    return { type: "FeatureCollection", features: [selectedDistrict] };
  }, [districts, isDistrictFocusMode, selectedDistrict]);
  const visibleGemeinden = useMemo<GemeindeFeatureCollection | null>(() => {
    if (!gemeinden) return null;
    if (!selectedGemeinde) return gemeinden;
    return { type: "FeatureCollection", features: [selectedGemeinde] };
  }, [gemeinden, selectedGemeinde]);
  const selectedDistrictBounds = useMemo(() => (selectedDistrict ? calculateFeatureBounds(selectedDistrict) : null), [selectedDistrict]);
  const selectedGemeindeBounds = useMemo(() => (selectedGemeinde ? calculateFeatureBounds(selectedGemeinde) : null), [selectedGemeinde]);
  const allDistrictBounds = useMemo(() => districts ? calculateFeaturesBounds(districts.features) : null, [districts]);
  const selectedAreaBounds = useMemo(
    () => focusedManagedArea ? calculateCoordinateBounds(focusedManagedArea.polygon) : null,
    [focusedManagedArea],
  );
  const activeAdminMapBounds = selectedAreaBounds ?? selectedGemeindeBounds ?? (isDistrictFocusMode ? selectedDistrictBounds : allDistrictBounds);
  const effectiveAdminBaseMapId: BaseMapId = isDistrictFocusMode ? adminBaseMapId : "street";
  const gemeindePopulationTotal = useMemo(
    () => gemeinden?.features.reduce((sum, feature) => sum + (feature.properties.einwohner_zensus ?? 0), 0) ?? 0,
    [gemeinden],
  );
  const topGemeinden = useMemo(
    () =>
      [...(gemeinden?.features ?? [])]
        .sort((a, b) => (b.properties.einwohner_zensus ?? 0) - (a.properties.einwohner_zensus ?? 0))
        .slice(0, 5),
    [gemeinden],
  );
  const linkedMunicipality = selectedDistrict
    ? findMunicipalityForDistrict(municipalities, selectedDistrict, forestAreas)
    : null;
  const linkedMissions = linkedMunicipality ? missions.filter((mission) => linkedMunicipality.missionIds.includes(mission.id)) : [];
  const detailArea = forestAreas.find((area) => area.id === detailAreaId && area.status !== "archiviert") ?? null;
  const detailAreaBounds = useMemo(
    () => detailArea ? calculateCoordinateBounds(detailArea.polygon) : null,
    [detailArea],
  );
  const detailAreaMissions = useMemo(() => detailArea ? missions.filter((mission) => mission.areaId === detailArea.id) : [], [detailArea, missions]);
  const detailMission = detailAreaMissions.find((mission) => mission.id === detailMissionId) ?? null;
  const detailPersistedResult = useMemo(() => detailMission ? missionRecords
    .filter((record) => record.missionId === detailMission.id && record.observations?.length)
    .sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt) - Date.parse(a.updatedAt ?? a.createdAt))[0] ?? null : null, [detailMission, missionRecords]);
  const detailMissionObservations = useMemo(() => {
    if (detailPersistedResult?.observations?.length) return detailPersistedResult.observations;
    if (!detailArea || !detailMission?.missionPath || missionPathWaypointsFlat(detailMission.missionPath).length < 2) return [];
    const generated = generateScenario(detailMission.seed, detailMission.params);
    const forestArea: ForestArea = { id: detailArea.id, name: detailArea.name, polygon: detailArea.polygon, hectares: detailArea.hectares, authority: detailArea.scopeName };
    const forestPath = buildForestPath(missionPathWaypointsFlat(detailMission.missionPath), detailMission.missionPath.name);
    const missionScenario = { ...generated, forestArea, forestPath };
    return generateObservations(generateMission(missionScenario, { areaId: detailArea.id, municipalityId: detailMission.municipalityId }), missionScenario);
  }, [detailArea, detailMission, detailPersistedResult]);
  const detailHeatmapLayer = getLayerDefinition(detailHeatmapLayerId);
  const detailHeatmapOptions = useMemo(() => ({ mode: detailHeatmapMode, maxDistanceMeters: detailHeatmapMaxDistance, minConfidence: detailHeatmapMinConfidence }), [detailHeatmapMaxDistance, detailHeatmapMinConfidence, detailHeatmapMode]);
  const { image: detailMissionHeatmap } = useForestHeatmap(detailMissionObservations, detailHeatmapLayer, detailArea?.polygon ?? [], Boolean(detailArea && detailMission), detailHeatmapOptions);
  const chronologicalDetailMissions = useMemo(() => detailAreaMissions
    .filter((mission) => missionPathWaypointsFlat(mission.missionPath).length >= 2)
    .filter((mission) => !timelineFrom || mission.requestedAt.slice(0, 10) >= timelineFrom)
    .filter((mission) => !timelineTo || mission.requestedAt.slice(0, 10) <= timelineTo)
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()), [detailAreaMissions, timelineFrom, timelineTo]);

  useEffect(() => {
    setTimelineIndex((current) => Math.min(current, Math.max(0, chronologicalDetailMissions.length - 1)));
  }, [chronologicalDetailMissions.length]);

  useEffect(() => {
    if (!isTimelinePlaying || chronologicalDetailMissions.length === 0) return;
    const intervalId = window.setInterval(() => {
      setTimelineIndex((current) => {
        if (current >= chronologicalDetailMissions.length - 1) {
          setIsTimelinePlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1_800);
    return () => window.clearInterval(intervalId);
  }, [chronologicalDetailMissions.length, isTimelinePlaying]);

  useEffect(() => {
    if (!isTimelinePlaying) return;
    const mission = chronologicalDetailMissions[timelineIndex];
    if (mission) setDetailMissionId(mission.id);
  }, [chronologicalDetailMissions, isTimelinePlaying, timelineIndex]);
  const periodScopeAreaIds = new Set(forestAreas
    .filter((area) => area.status !== "archiviert")
    .filter((area) => selectedGemeinde
      ? area.scopeId === `gemeinde-${selectedGemeinde.properties.gemeinde_id}` || geometryContainsCoordinate(selectedGemeinde.geometry, centroidOf(area.polygon))
      : selectedDistrict
        ? geometryContainsCoordinate(selectedDistrict.geometry, centroidOf(area.polygon))
        : true)
    .map((area) => area.id));
  const availableForestAveragePeriods = Array.from(new Set(
    missions
      .filter((mission) => periodScopeAreaIds.has(mission.areaId) && (Boolean(mission.routeSummary) || missionPathWaypointsFlat(mission.missionPath).length >= 2))
      .map((mission) => missionPeriodKey(mission.requestedAt, forestAveragePeriodMode)),
  )).sort().reverse();
  const activeForestAveragePeriod = selectedForestAveragePeriod && availableForestAveragePeriods.includes(selectedForestAveragePeriod)
    ? selectedForestAveragePeriod
    : availableForestAveragePeriods[0] ?? "";
  const latestSummaryByArea = new Map<string, CustomerMissionTemplate>();
  missions
    .filter((mission) => mission.routeSummary && missionPeriodKey(mission.requestedAt, forestAveragePeriodMode) === activeForestAveragePeriod)
    .sort((a, b) => new Date(b.routeSummary!.calculatedAt).getTime() - new Date(a.routeSummary!.calculatedAt).getTime())
    .forEach((mission) => { if (!latestSummaryByArea.has(mission.areaId)) latestSummaryByArea.set(mission.areaId, mission); });

  useEffect(() => {
    onBaseMapChange(adminBaseMapId);
  }, [adminBaseMapId, onBaseMapChange]);

  useEffect(() => {
    if (!detailArea || !detailAreaBounds) {
      setOsmForestPaths([]);
      setOsmPathState("idle");
      setOsmPathProgress(0);
      return;
    }
    const controller = new AbortController();
    setOsmPathState("loading");
    setOsmPathProgress(5);
    fetchOsmForestPaths(detailArea, controller.signal, (progress) => { setOsmPathProgress(progress.percent); setOsmPathStatus(progress); })
      .then((paths) => {
        setOsmForestPaths(paths);
        setOsmPathState("ready");
        setOsmPathProgress(100);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setOsmForestPaths([]);
        setOsmPathState("error");
        setOsmPathProgress(0);
        setOsmPathStatus({ percent: 0, stage: "error", message: errorMessage(error), count: 0 });
      });
    return () => controller.abort();
  }, [detailArea, detailAreaBounds, osmReloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    fetch(districtGeoJsonUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("GeoJSON request failed");
        return response.json() as Promise<DistrictFeatureCollection>;
      })
      .then((collection) => {
        const features = collection.features.filter((feature) => feature.properties.NAME_1 === "Baden-Württemberg");
        setDistricts({ type: "FeatureCollection", features });
        const focusArea = forestAreas.find((area) => area.id === focusAreaId);
        const scopeDistrictId = focusArea?.scopeId.startsWith("kreis-") ? Number(focusArea.scopeId.slice("kreis-".length)) : null;
        const containing = focusArea ? features.find((feature) => geometryContainsCoordinate(feature.geometry, centroidOf(focusArea.polygon))) : null;
        setSelectedDistrictId((Number.isFinite(scopeDistrictId) ? features.find((feature) => feature.properties.ID_3 === scopeDistrictId) : null)?.properties.ID_3 ?? containing?.properties.ID_3 ?? null);
        setLoadState("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadState("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isDistrictFocusMode || !selectedDistrict) {
      setGemeinden(null);
      setSelectedGemeindeId(null);
      setGemeindenLoadState("idle");
      return;
    }

    const controller = new AbortController();
    setGemeindenLoadState("loading");
    fetch(buildGemeindeWfsUrl(selectedDistrict.properties.NAME_3), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Gemeinden request failed");
        return response.json() as Promise<GemeindeFeatureCollection>;
      })
      .then((collection) => {
        const features = collection.features ?? [];
        setGemeinden({ type: "FeatureCollection", features });
        const focusArea = forestAreas.find((area) => area.id === focusAreaId);
        const scopeGemeindeId = focusArea?.scopeId.startsWith("gemeinde-") ? focusArea.scopeId.slice("gemeinde-".length) : null;
        const matching = features.find((feature) => feature.properties.gemeinde_id === scopeGemeindeId)
          ?? (focusArea ? features.find((feature) => geometryContainsCoordinate(feature.geometry, centroidOf(focusArea.polygon))) : null);
        setSelectedGemeindeId(matching?.properties.gemeinde_id ?? null);
        setGemeindenLoadState("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setGemeinden(null);
        setGemeindenLoadState("error");
      });
    return () => controller.abort();
  }, [focusAreaId, forestAreas, isDistrictFocusMode, selectedDistrict]);

  useEffect(() => {
    if (!focusMunicipalityId || !districts) return;
    const municipality = municipalities.find((item) => item.id === focusMunicipalityId);
    if (!municipality) return;
    const district = districts.features.find((feature) => geometryContainsCoordinate(feature.geometry, municipality.center));
    setSelectedDistrictId(district?.properties.ID_3 ?? null);
    setIsDistrictFocusMode(Boolean(district));
    setDrawingMunicipalityId(municipality.id);
  }, [districts, focusMunicipalityId, municipalities]);

  useEffect(() => {
    if (!focusMunicipalityId || !gemeinden) return;
    const municipality = municipalities.find((item) => item.id === focusMunicipalityId);
    if (!municipality) return;
    const administrativeId = municipality.administrativeScopeId?.startsWith("gemeinde-")
      ? municipality.administrativeScopeId.slice("gemeinde-".length)
      : null;
    const matching = gemeinden.features.find((feature) => feature.properties.gemeinde_id === administrativeId)
      ?? gemeinden.features.find((feature) => geometryContainsCoordinate(feature.geometry, municipality.center));
    setSelectedGemeindeId(matching?.properties.gemeinde_id ?? null);
  }, [focusMunicipalityId, gemeinden, municipalities]);

  useEffect(() => {
    setDraftForestPolygon([]);
    setIsForestDrawingEnabled(false);
  }, [currentForestScope.id]);

  useEffect(() => {
    if (focusAreaId) setIsDistrictFocusMode(true);
  }, [focusAreaId]);

  useEffect(() => {
    if (!focusedManagedArea || focusedManagedArea.boundaryStatus !== "pending") return;
    setEditingMapAreaId(focusedManagedArea.id);
    setDraftForestName(focusedManagedArea.name);
    setDraftForestPolygon([]);
    setDrawingMunicipalityId(focusedManagedArea.municipalityId ?? "");
    setIsForestDrawingEnabled(true);
  }, [focusedManagedArea]);

  useEffect(() => {
    if (!focusAreaId || !districts) return;
    const focusArea = forestAreas.find((area) => area.id === focusAreaId);
    if (!focusArea) return;
    const explicitId = focusArea.scopeId.startsWith("kreis-") ? Number(focusArea.scopeId.slice("kreis-".length)) : null;
    const district = (Number.isFinite(explicitId) ? districts.features.find((feature) => feature.properties.ID_3 === explicitId) : null)
      ?? districts.features.find((feature) => geometryContainsCoordinate(feature.geometry, centroidOf(focusArea.polygon)));
    setSelectedDistrictId(district?.properties.ID_3 ?? null);
    setDrawingMunicipalityId(focusArea.municipalityId ?? "");
    setIsDistrictFocusMode(Boolean(district));
  }, [districts, focusAreaId, forestAreas]);

  const districtStyle = (feature?: BadenWuerttembergDistrictFeature) => {
    const isSelected = feature?.properties.ID_3 === selectedDistrictId;
    if (isDistrictFocusMode) {
      return {
        color: "#f8fafc",
        weight: 2,
        fillColor: "#0f766e",
        fillOpacity: 0.08,
        opacity: 0.96,
      };
    }
    return {
      color: isSelected ? "#111827" : "#2f3430",
      weight: isSelected ? 2.6 : 1.1,
      fillColor: isSelected ? "#0f766e" : "#f1f3f0",
      fillOpacity: isSelected ? 0.42 : 0.72,
      opacity: 0.96,
    };
  };

  const attachDistrictEvents = (
    feature: BadenWuerttembergDistrictFeature,
    layer: { on: (handlers: Record<string, () => void>) => void; bindTooltip: (content: string, options?: Record<string, unknown>) => void },
  ) => {
    layer.bindTooltip(feature.properties.NAME_3, {
      className: "adminDistrictLabel",
      direction: "center",
      permanent: !isDistrictFocusMode,
      opacity: 0.92,
    });
    layer.on({
      click: () => {
        onClearAreaFocus();
        setSelectedDistrictId(feature.properties.ID_3);
        setSelectedGemeindeId(null);
        setIsDistrictFocusMode(true);
        const municipality = findMunicipalityForDistrict(municipalities, feature, forestAreas);
        setDrawingMunicipalityId(municipality?.id ?? "");
        onSelectMunicipalityContext(municipality?.id ?? null);
        setMapManagementError(municipality ? null : "Für diesen Landkreis ist noch keine eindeutige Portal-Gemeinde verknüpft. Bitte unten eine Gemeinde auswählen.");
      },
      mouseover: () => {
        if (!isDistrictFocusMode) setSelectedDistrictId(feature.properties.ID_3);
      },
    });
  };

  const gemeindeStyle = (feature?: GemeindeFeature) => {
    const isSelected = feature?.properties.gemeinde_id === selectedGemeindeId;
    return {
      color: isSelected ? "#fbbf24" : "#f8fafc",
      weight: isSelected ? 2.4 : 1.1,
      fillColor: isSelected ? "#fbbf24" : "#f8fafc",
      fillOpacity: isSelected ? 0.16 : 0.04,
      opacity: 0.92,
    };
  };

  const attachGemeindeEvents = (
    feature: GemeindeFeature,
    layer: { bindTooltip: (content: string, options?: Record<string, unknown>) => void; on: (handlers: Record<string, () => void>) => void },
  ) => {
    const population = feature.properties.einwohner_zensus ?? 0;
    const share = gemeindePopulationTotal > 0 ? Math.round((population / gemeindePopulationTotal) * 100) : 0;
    layer.bindTooltip(`${feature.properties.gemeinde_name} · ${share}%`, {
      className: "adminGemeindeLabel",
      direction: "center",
      permanent: false,
      opacity: 0.9,
    });
    layer.on({
      click: () => {
        onClearAreaFocus();
        setSelectedGemeindeId(feature.properties.gemeinde_id);
        const scopeId = `gemeinde-${feature.properties.gemeinde_id}`;
        const municipality = municipalities.find((item) => item.administrativeScopeId === scopeId)
          ?? municipalities.find((item) => forestAreas.some((area) => area.scopeId === scopeId && area.municipalityId === item.id));
        setDrawingMunicipalityId(municipality?.id ?? "");
        onSelectMunicipalityContext(municipality?.id ?? null);
        setMapManagementError(municipality ? null : "Diese Verwaltungsfläche ist noch keiner Portal-Gemeinde zugeordnet. Bitte eine Gemeinde explizit auswählen.");
      },
    });
  };

  const addDraftForestPoint = (coordinate: Coordinate) => {
    if (!isDistrictFocusMode) return;
    setDraftForestPolygon((current) => [...current, coordinate]);
  };

  const saveDraftForest = () => {
    if (draftForestPolygon.length < 3) return;
    if (!drawingMunicipalityId) {
      setMapManagementError("Speichern blockiert: Bitte zuerst die zuständige Portal-Gemeinde auswählen.");
      return;
    }
    const timestamp = new Date().toISOString();
    const municipalityId = drawingMunicipalityId;
    const existing = editingMapAreaId ? forestAreas.find((area) => area.id === editingMapAreaId) : null;
    const area: DeploymentArea = normalizeDeploymentArea({
      ...existing,
      id: existing?.id ?? `forest-${Date.now()}`,
      name: draftForestName.trim() || "Waldgebiet",
      municipalityId,
      scopeId: currentForestScope.id,
      scopeName: currentForestScope.name,
      polygon: draftForestPolygon,
      boundaryStatus: "defined",
      hectares: calculatePolygonHectares(draftForestPolygon),
      focus: existing?.focus ?? "Allgemeines Waldmonitoring",
      description: existing?.description ?? "Auf der Verwaltungskarte eingezeichnet",
      status: existing?.status ?? "planung",
      dataOrigin: existing?.dataOrigin ?? "external",
      dataStatus: existing?.dataStatus ?? "unknown",
      source: existing?.source ?? "Manuelle Kartenzeichnung",
      confidence: existing?.confidence ?? null,
      linkageStatus: "linked",
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    void onSaveArea(area);
    onSelectArea(area.id);
    setMapManagementError(null);
    setDraftForestPolygon([]);
    setIsForestDrawingEnabled(false);
    setEditingMapAreaId(null);
  };

  const beginAreaRedraw = (area: DeploymentArea) => {
    onSelectArea(area.id);
    setEditingMapAreaId(area.id);
    setDraftForestName(area.name);
    setDraftForestPolygon([]);
    setDrawingMunicipalityId(area.municipalityId ?? "");
    setIsForestDrawingEnabled(true);
  };

  const selectOrOpenArea = (area: DeploymentArea) => {
    if (area.id === selectedAreaId) {
      setDetailAreaId(area.id);
      onDetailAreaChange(area.id);
      setDetailMissionId(null);
      return;
    }
    onSelectArea(area.id, true);
  };

  if (detailArea && detailAreaBounds) {
    return (
      <div className="forestDetailShell">
        <header className="forestDetailHeader">
          <button className="commandButton" onClick={() => { setDetailAreaId(null); onDetailAreaChange(null); setDetailMissionId(null); }} type="button">
            <ArrowLeft size={16} />
            Zur Gemeinde
          </button>
          <div>
            <p className="eyebrow">Waldgebiet</p>
            <h1>{detailArea.name}</h1>
            <small>{detailArea.hectares.toLocaleString("de-DE")} ha · {detailArea.scopeName}</small>
          </div>
          <button className="commandButton primary" onClick={onOpenGeo} type="button">
            <MapPinned size={16} />
            In GeoID öffnen
          </button>
        </header>
        <main className="forestDetailLayout">
          <section className="forestDetailMapPanel">
            <MapContainer
              center={toLatLng(centroidOf(detailArea.polygon))}
              zoom={15}
              minZoom={12}
              maxZoom={19}
              maxBoundsViscosity={1}
              scrollWheelZoom
              preferCanvas
              className="forestDetailMap"
            >
              <ForestAreaViewport bounds={detailAreaBounds} focusKey={detailArea.id} />
              <ForestDrawingCapture enabled={canManage && isMissionPlannerOpen} onPick={(coordinate) => {
                const geometry = { coordinates: [detailArea.polygon.map((point) => [point.lng, point.lat])] };
                if (!geometryContainsCoordinate(geometry, coordinate)) {
                  setMissionPlannerFeedback("Routenpunkte müssen innerhalb des Waldgebiets liegen.");
                  return;
                }
                setMissionRoute((current) => [...current, coordinate]);
                setMissionPlannerFeedback(null);
              }} />
              <TileLayer
                attribution={baseMaps[adminBaseMapId].attribution}
                maxZoom={19}
                maxNativeZoom={adminBaseMapId === "satellite" ? 19 : adminBaseMapId === "topo" ? 17 : 19}
                url={baseMaps[adminBaseMapId].url}
              />
              <Polygon
                positions={detailArea.polygon.map(toLatLng)}
                pathOptions={{ color: "#fbbf24", fillColor: "#16a34a", fillOpacity: 0.3, weight: 4 }}
              >
                <Tooltip permanent direction="center">{detailArea.name}</Tooltip>
              </Polygon>
              {detailMissionHeatmap && <ImageOverlay url={detailMissionHeatmap.url} bounds={detailMissionHeatmap.bounds} opacity={0.72} interactive={false} />}
              {detailMission?.missionPath && <Polyline positions={missionPathSegments(detailMission.missionPath).map((segment) => segment.map(toLatLng))} pathOptions={{ color: "#0f766e", weight: 4, opacity: 0.9 }}>
                <Tooltip>{detailMission.title} · gespeicherter Missionsweg</Tooltip>
              </Polyline>}
              {osmForestPaths.map((path) => (
                <Polyline
                  key={`osm-path-${path.id}`}
                  positions={path.coordinates.map(toLatLng)}
                  bubblingMouseEvents={false}
                  eventHandlers={{ mouseover: () => setHoveredOsmPathId(path.id), mouseout: () => setHoveredOsmPathId(null), click: () => {
                    if (!canManage || !isMissionPlannerOpen) return;
                    setMissionRoute(path.coordinates);
                    setMissionPlannerFeedback(`${path.name} wurde als Missionsroute übernommen.`);
                  } }}
                  pathOptions={{ color: hoveredOsmPathId === path.id ? "#f59e0b" : "#0f766e", weight: hoveredOsmPathId === path.id ? 7 : isMissionPlannerOpen ? 5 : 3, opacity: 0.96, renderer: detailOsmPathRenderer }}
                >
                  <Tooltip sticky>{isMissionPlannerOpen ? `${path.name} · anklicken und als Route übernehmen` : path.name}</Tooltip>
                </Polyline>
              ))}
              {missionRoute.length > 0 && (
                <Polyline positions={missionRoute.map(toLatLng)} pathOptions={{ color: "#2563eb", weight: 4, dashArray: "8 6" }} />
              )}
              {missionRoute.map((point, index) => (
                <CircleMarker key={`${point.lat}-${point.lng}-${index}`} center={toLatLng(point)} radius={5} pathOptions={{ color: "#fff", fillColor: "#2563eb", fillOpacity: 1, weight: 2 }}>
                  <Tooltip>{`Routenpunkt ${index + 1}`}</Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
            <div className="mapOverlay forestDetailBaseMaps" aria-label="Basiskarte">
              {(["street", "topo", "satellite"] as BaseMapId[]).map((mapId) => (
                <button key={mapId} className={adminBaseMapId === mapId ? "active" : ""} onClick={() => setAdminBaseMapId(mapId)} type="button">
                  {mapId === "street" ? "Karte" : mapId === "topo" ? "Topo" : "Satellit"}
                </button>
              ))}
            </div>
            {detailMission && <label className="mapOverlay forestDetailHeatmapSelect">
              Heatmap-Wert
              <select value={detailHeatmapLayerId} onChange={(event) => setDetailHeatmapLayerId(event.target.value as LayerId)} disabled={!detailMission.missionPath}>
                {layerDefinitions.filter((layer) => !copernicusLayerIds.includes(layer.id)).map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
              </select>
              <span>Darstellung</span>
              <select value={detailHeatmapMode} onChange={(event) => setDetailHeatmapMode(event.target.value as "full" | "confidence")} disabled={detailMissionObservations.length === 0}>
                <option value="full">Vollständig · Confidence-Abblendung</option>
                <option value="confidence">Confidence-begrenzt</option>
              </select>
              {detailHeatmapMode === "confidence" && <>
                <span>Max. Distanz: {detailHeatmapMaxDistance} m</span>
                <input type="range" min={10} max={100} step={5} value={detailHeatmapMaxDistance} onChange={(event) => setDetailHeatmapMaxDistance(Number(event.target.value))} />
                <span>Min. Confidence: {Math.round(detailHeatmapMinConfidence * 100)} %</span>
                <input type="range" min={0} max={1} step={0.05} value={detailHeatmapMinConfidence} onChange={(event) => setDetailHeatmapMinConfidence(Number(event.target.value))} />
              </>}
              <small>{detailPersistedResult ? `${detailMission.title} · gespeicherte Messwerte · Anzeige modelliert/interpoliert` : detailMission.missionPath ? `${detailMission.title} · Vorschau aus Seed, noch nicht als Ergebnis gespeichert` : "Für diese Mission ist noch kein Weg gespeichert."}</small>
            </label>}
            <div className="mapOverlay forestMissionTimeline">
              <button className="primaryIconButton" type="button" disabled={chronologicalDetailMissions.length === 0} onClick={() => {
                if (!isTimelinePlaying && timelineIndex >= chronologicalDetailMissions.length - 1) setTimelineIndex(0);
                const mission = chronologicalDetailMissions[timelineIndex >= chronologicalDetailMissions.length ? 0 : timelineIndex];
                if (mission) setDetailMissionId(mission.id);
                setIsTimelinePlaying((playing) => !playing);
              }} aria-label={isTimelinePlaying ? "Zeitreihe pausieren" : "Zeitreihe abspielen"}>{isTimelinePlaying ? <Pause size={17} /> : <Play size={17} />}</button>
              <label>Von<input type="date" value={timelineFrom} onChange={(event) => { setTimelineFrom(event.target.value); setTimelineIndex(0); setIsTimelinePlaying(false); }} /></label>
              <label>Bis<input type="date" value={timelineTo} onChange={(event) => { setTimelineTo(event.target.value); setTimelineIndex(0); setIsTimelinePlaying(false); }} /></label>
              <div className="forestMissionTimelineSlider">
                <span>{chronologicalDetailMissions.length > 0 ? new Date(chronologicalDetailMissions[timelineIndex]?.requestedAt ?? chronologicalDetailMissions[0].requestedAt).toLocaleDateString("de-DE") : "Keine Missionsdaten im Zeitraum"}</span>
                <input type="range" min={0} max={Math.max(0, chronologicalDetailMissions.length - 1)} value={Math.min(timelineIndex, Math.max(0, chronologicalDetailMissions.length - 1))} disabled={chronologicalDetailMissions.length === 0} onChange={(event) => {
                  const nextIndex = Number(event.target.value);
                  setTimelineIndex(nextIndex);
                  setIsTimelinePlaying(false);
                  const mission = chronologicalDetailMissions[nextIndex];
                  if (mission) setDetailMissionId(mission.id);
                }} />
                <small>{chronologicalDetailMissions.length} Missionen chronologisch</small>
              </div>
            </div>
          </section>
          <aside className="forestMissionPanel">
            <div className="forestMissionHeading">
              <div>
                <p className="eyebrow">Missionen</p>
                <h2>{detailArea.name}</h2>
              </div>
              <span>{detailAreaMissions.length}</span>
            </div>
            <div className={`osmPathStatus ${osmPathState}`}>
              <span>Vorhandene Waldwege</span>
              <strong>{osmPathState === "loading" ? `${osmPathStatus?.message ?? "Wege werden geladen …"} ${osmPathProgress}%` : osmPathState === "error" ? osmPathStatus?.message ?? "Wegdaten derzeit nicht verfügbar" : `${osmForestPaths.length} Wege im Gebiet · ${formatOsmSource(osmPathStatus?.source)}`}</strong>
              {osmPathState === "loading" && <progress max={100} value={osmPathProgress}>{osmPathProgress}%</progress>}
              {osmPathState === "error" && <button className="textButton" type="button" onClick={() => setOsmReloadKey((value) => value + 1)}>Wegenetz erneut laden</button>}
              {osmPathState === "ready" && osmForestPaths.length > 0 && <small>OpenStreetMap-Wegdaten · auf einen grünen Weg klicken, um ihn bei geöffneter Planung zu übernehmen.</small>}
            </div>
            {canManage && <button className={`commandButton primary forestMissionPlanButton ${isMissionTypeChoiceOpen ? "active" : ""}`} onClick={() => { setIsMissionTypeChoiceOpen((open) => !open); setMissionPlannerFeedback(null); }} type="button">
              <Plus size={16} />
              {isMissionTypeChoiceOpen ? "Auswahl schließen" : "Mission erstellen"}
            </button>}
            {canManage && isMissionTypeChoiceOpen && (
              <div className="missionTypeChoice">
                <button onClick={() => {
                  onOpenRealMissionUpload(detailArea.id, missionRoute.length >= 2 ? missionRoute : []);
                }} type="button">
                  <span>A · Reale Mission</span>
                  <strong>Mission anlegen & Daten hochladen</strong>
                  <small>Öffnet eine getrennte Upload-Maske. Dateien bleiben bis zur Prüfung als real / ungeprüft markiert.</small>
                  <Upload size={18} />
                </button>
                <button onClick={() => {
                  onOpenMockMission(detailArea.id, []);
                }} type="button">
                  <span>B · Mock-Mission</span>
                  <strong>Mock-Daten in GeoID konfigurieren</strong>
                  <small>Öffnet den vorhandenen Scenario Builder mit Waldgebiet und Route als Kontext.</small>
                  <BarChart3 size={18} />
                </button>
                <button className="missionTypeManual" onClick={() => { setIsMissionPlannerOpen(true); setIsMissionTypeChoiceOpen(false); }} type="button">
                  Route zuerst manuell planen
                </button>
              </div>
            )}
            {canManage && isMissionPlannerOpen && (
              <form className="forestMissionPlanner" onSubmit={(event) => {
                event.preventDefault();
                if (!missionTitle.trim() || !missionObjective.trim()) { setMissionPlannerFeedback("Bitte Titel und Ziel der Mission angeben."); return; }
                if (missionRoute.length < 2) { setMissionPlannerFeedback("Bitte mindestens zwei Punkte auf der Karte einzeichnen."); return; }
                setMissionPlannerFeedback("Mission wird gespeichert …");
                void onPlanForestMission(detailArea.id, { title: missionTitle, objective: missionObjective, priority: missionPriority, route: missionRoute, requestedAt: missionDate })
                  .then(() => { setMissionPlannerFeedback("Mission wurde geplant."); setMissionRoute([]); setMissionTitle("Waldmission"); setMissionObjective("Zustandserfassung und Kontrollgang"); setIsMissionPlannerOpen(false); })
                  .catch((error) => setMissionPlannerFeedback(errorMessage(error)));
              }}>
                <label className="fieldLabel">Titel<input value={missionTitle} onChange={(event) => setMissionTitle(event.target.value)} /></label>
                <label className="fieldLabel">Missionsziel<textarea value={missionObjective} onChange={(event) => setMissionObjective(event.target.value)} /></label>
                <label className="fieldLabel">Priorität<select value={missionPriority} onChange={(event) => setMissionPriority(event.target.value as PlannedMissionRecord["priority"])}><option value="normal">Normal</option><option value="hoch">Hoch</option><option value="kritisch">Kritisch</option></select></label>
                <label className="fieldLabel">Erhebungsdatum<input type="date" value={missionDate} onChange={(event) => setMissionDate(event.target.value)} required /></label>
                <p className="missionDrawHint"><MapPinned size={15} />Auf die Karte klicken, um die Route einzuzeichnen. Aktuell: {missionRoute.length} Punkte.</p>
                <button className="commandButton osmPathAdoptButton" onClick={() => {
                  const longest = osmForestPaths.reduce<OsmForestPath | null>((best, path) => !best || path.coordinates.length > best.coordinates.length ? path : best, null);
                  if (!longest) { setMissionPlannerFeedback("In diesem Waldgebiet wurde kein übernehmbarer Weg gefunden."); return; }
                  setMissionRoute(longest.coordinates);
                  setMissionPlannerFeedback(`${longest.name} wurde als Missionsroute übernommen.`);
                }} disabled={osmForestPaths.length === 0} type="button">
                  <MapPinned size={15} />Längsten vorhandenen Weg übernehmen
                </button>
                <div className="forestMissionPlannerActions">
                  <button className="commandButton" onClick={() => { setIsMissionPlannerOpen(false); setMissionPlannerFeedback(null); }} type="button"><ArrowLeft size={15} />Planung schließen</button>
                  <button className="commandButton" onClick={() => setMissionRoute((current) => current.slice(0, -1))} disabled={missionRoute.length === 0} type="button"><Undo2 size={15} />Punkt zurück</button>
                  <button className="commandButton" onClick={() => setMissionRoute([])} disabled={missionRoute.length === 0} type="button"><Trash2 size={15} />Route leeren</button>
                  <button className="commandButton primary" disabled={missionRoute.length < 2} type="submit"><Save size={15} />Mission speichern</button>
                </div>
                {missionPlannerFeedback && <p className="missionPlannerFeedback" role="status">{missionPlannerFeedback}</p>}
              </form>
            )}
            {detailAreaMissions.length === 0 ? (
              <p className="emptyRecordHistory">Für dieses Waldgebiet sind noch keine Missionen hinterlegt.</p>
            ) : (
              <div className="forestMissionList">
                {detailAreaMissions.map((mission) => (
                  <div key={mission.id} className="forestMissionRow">
                    <button className={`forestMissionOpenButton ${detailMissionId === mission.id ? "selected" : ""}`} onClick={() => setDetailMissionId((current) => current === mission.id ? null : mission.id)} type="button" aria-label={`${mission.title} auf der Waldkarte auswählen`}>
                      <span>{new Date(mission.requestedAt).toLocaleDateString("de-DE")} · Priorität {mission.priority}</span>
                      <strong>{mission.title}</strong>
                      <small>{mission.objective}</small>
                      <Eye className="forestMissionOpenIcon" size={17} aria-hidden="true" />
                    </button>
                    {detailMissionId === mission.id && <button className="commandButton forestMissionEnterButton" onClick={() => onOpenMission(mission)} type="button">Missionsansicht öffnen</button>}
                    {canManage && <button className="commandButton" onClick={() => { if (window.confirm(`Nur die Planung „${mission.title}“ archivieren? Gespeicherte Ergebnisse bleiben erhalten.`)) void onArchiveMission(mission.id); }} type="button" aria-label={`${mission.title} archivieren`} title="Nur Planung archivieren">
                      Archivieren
                    </button>}
                    {canManage && <button className="forestMissionDeleteButton" onClick={() => { if (window.confirm(`„${mission.title}“ sowie alle gespeicherten Messwerte, Detektionen und Ergebnisse dauerhaft löschen?`)) void onDeleteMission(mission.id); }} type="button" aria-label={`${mission.title} vollständig löschen`} title="Planung und Ergebnisse dauerhaft löschen">
                      <Trash2 size={15} />
                    </button>}
                  </div>
                ))}
              </div>
            )}
            {detailMission && (
              <div className="forestMissionDetail">
                <span>Ausgewählte Mission</span>
                <strong>{detailMission.title}</strong>
                <dl>
                  <div><dt>Auftraggeber</dt><dd>{detailMission.customer}</dd></div>
                  <div><dt>Szenario</dt><dd>{detailMission.scenarioName}</dd></div>
                  <div><dt>Route</dt><dd>{detailMission.pathName}</dd></div>
                  <div><dt>Seed</dt><dd>{detailMission.seed}</dd></div>
                </dl>
              </div>
            )}
            <p className="provenanceNote">Angezeigt werden ausschließlich Missionen, deren gespeicherte <code>areaId</code> diesem Waldgebiet entspricht.</p>
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="portalShell adminMapShell">
      <header className="portalTopbar">
        <div className="portalBrand">
          <div className="brandMark">
            <MapPinned size={20} />
          </div>
          <div>
            <p className="eyebrow">Kartenansicht</p>
            <h1>Baden-Württemberg Verwaltungsgebiete</h1>
          </div>
        </div>
        <div className="portalTopActions">
          <button className="commandButton" onClick={onBackToPortal} type="button">
            <ArrowLeft size={16} />
            Portal
          </button>
          <button className="commandButton primary" onClick={onOpenGeo} type="button">
            <MapPinned size={16} />
            GeoID öffnen
          </button>
        </div>
      </header>

      <main className="adminMapLayout">
        <section className="adminMapPanel">
          {feedback && <div className={`managementFeedback adminFeedback ${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.message}</div>}
          <MapContainer center={[48.78, 9.16]} zoom={8} minZoom={7} maxZoom={19} scrollWheelZoom className={`adminMap ${!isDistrictFocusMode ? "adminMapVectorOverview" : ""}`}>
            <AdminMapViewport bounds={activeAdminMapBounds} />
            <ForestDrawingCapture enabled={isForestDrawingEnabled} onPick={addDraftForestPoint} />
            {isDistrictFocusMode && <TileLayer
              key={`${isDistrictFocusMode ? "focus" : "overview"}-${effectiveAdminBaseMapId}`}
              className={!isDistrictFocusMode ? "adminMapOverviewTiles" : effectiveAdminBaseMapId === "satellite" ? "adminMapSatelliteTiles" : "adminMapTiles"}
              attribution={baseMaps[effectiveAdminBaseMapId].attribution}
              maxZoom={19}
              maxNativeZoom={effectiveAdminBaseMapId === "satellite" ? 19 : effectiveAdminBaseMapId === "topo" ? 17 : 19}
              url={baseMaps[effectiveAdminBaseMapId].url}
            />}
            {showDistrictBoundaries && visibleDistricts && (
              <GeoJSON
                key={`${isDistrictFocusMode ? "focus" : "overview"}-${selectedDistrictId ?? "none"}-${visibleDistricts.features.length}`}
                data={visibleDistricts as never}
                style={districtStyle as never}
                onEachFeature={attachDistrictEvents as never}
              />
            )}
            {showMunicipalityBoundaries && isDistrictFocusMode && visibleGemeinden && (
              <GeoJSON
                key={`gemeinden-${selectedDistrictId ?? "none"}-${selectedGemeindeId ?? "all"}-${visibleGemeinden.features.length}`}
                data={visibleGemeinden as never}
                style={gemeindeStyle as never}
                onEachFeature={attachGemeindeEvents as never}
              />
            )}
            {showForestBoundaries && visibleForestAreas.map((area) => (
              <Polygon
                key={area.id}
                positions={area.polygon.map(toLatLng)}
                eventHandlers={{ click: () => selectOrOpenArea(area) }}
                pathOptions={{
                  color: area.id === selectedAreaId ? "#fbbf24" : "#22c55e",
                  fillColor: showForestAverages && latestSummaryByArea.get(area.id)?.routeSummary ? dryStressSummaryColor(latestSummaryByArea.get(area.id)!.routeSummary!.averageDryStress) : "#16a34a",
                  fillOpacity: area.boundaryStatus === "pending" ? 0.08 : showForestAverages && latestSummaryByArea.has(area.id) ? 0.55 : area.id === selectedAreaId ? 0.38 : 0.24,
                  weight: area.id === selectedAreaId ? 4 : 2,
                  dashArray: area.boundaryStatus === "pending" ? "7 6" : undefined,
                }}
              >
                <Tooltip sticky direction="center">
                  {area.name}{showForestAverages && latestSummaryByArea.get(area.id)?.routeSummary ? ` · ${Math.round(latestSummaryByArea.get(area.id)!.routeSummary!.averageDryStress * 100)}% abgeleitet` : ""}
                </Tooltip>
              </Polygon>
            ))}
            {showForestBoundaries && draftForestPolygon.length > 0 && (
              <Polygon
                positions={draftForestPolygon.map(toLatLng)}
                pathOptions={{ color: "#fbbf24", fillColor: "#facc15", fillOpacity: 0.18, weight: 2, dashArray: "6 5" }}
              >
                <Tooltip permanent direction="center">
                  {draftForestName || "Waldgebiet"}
                </Tooltip>
              </Polygon>
            )}
          </MapContainer>
          {selectedGemeinde && (
            <button className="mapOverlay adminMapGemeindeBackButton" onClick={() => { onClearAreaFocus(); setSelectedGemeindeId(null); setDrawingMunicipalityId(linkedMunicipality?.id ?? ""); onSelectMunicipalityContext(linkedMunicipality?.id ?? null); }} type="button">
              <ArrowLeft size={16} />
              Zum Kreis
            </button>
          )}
          {isDistrictFocusMode && (
            <button className="mapOverlay adminMapBackButton" onClick={() => { onClearAreaFocus(); setIsDistrictFocusMode(false); setSelectedDistrictId(null); setSelectedGemeindeId(null); setDrawingMunicipalityId(""); onSelectMunicipalityContext(null); }} type="button">
              <ArrowLeft size={16} />
              Alle Kreise
            </button>
          )}
          <div className="mapOverlay adminLayerControl">
            {isDistrictFocusMode ? (
              <div className="adminLayerToggleGroup three" aria-label="Basiskarte">
                <button className={adminBaseMapId === "street" ? "active" : ""} onClick={() => setAdminBaseMapId("street")} type="button">
                  Karte
                </button>
                <button className={adminBaseMapId === "topo" ? "active" : ""} onClick={() => setAdminBaseMapId("topo")} type="button">
                  Topo
                </button>
                <button className={adminBaseMapId === "satellite" ? "active" : ""} onClick={() => setAdminBaseMapId("satellite")} type="button">
                  Satellit
                </button>
              </div>
            ) : (
              <div className="adminOverviewMode">Übersicht S/W</div>
            )}
            <label>
              <input type="checkbox" checked={showDistrictBoundaries} onChange={(event) => setShowDistrictBoundaries(event.target.checked)} />
              Kreisgrenzen
            </label>
            <label>
              <input type="checkbox" checked={showMunicipalityBoundaries} onChange={(event) => setShowMunicipalityBoundaries(event.target.checked)} disabled={!isDistrictFocusMode} />
              Gemeindegrenzen
            </label>
            <label>
              <input type="checkbox" checked={showForestBoundaries} onChange={(event) => setShowForestBoundaries(event.target.checked)} />
              Einsatzgebiete
            </label>
          </div>
          <div className="mapOverlay adminMapStatus">
            {loadState === "loading" && "Verwaltungsgrenzen werden geladen"}
            {loadState === "ready" &&
              (isDistrictFocusMode && selectedDistrict
                  ? `${selectedDistrict.properties.NAME_3} im Fokusmodus · ${gemeindenLoadState === "ready" ? `${gemeinden?.features.length ?? 0} Gemeinden` : "Gemeinden werden geladen"}`
                : `${districts?.features.length ?? 0} Stadt- und Landkreise geladen`)}
            {loadState === "error" && "GeoJSON konnte nicht geladen werden"}
          </div>
        </section>

        <aside className="adminMapInspector">
          <PanelTitle icon={<Building2 size={18} />} title="Ausgewähltes Gebiet" />
          {selectedDistrict ? (
            <>
              <div className="adminDistrictHero">
                <span>{selectedDistrict.properties.TYPE_3}</span>
                <strong>{selectedDistrict.properties.NAME_3}</strong>
                <small>Baden-Württemberg · AGS-ID {selectedDistrict.properties.ID_3}</small>
              </div>
              <div className="statusGrid">
                <StatusPill label="Quelle" value="GeoJSON" />
                <StatusPill label="Ebene" value="Kreise" />
                <StatusPill label="Mandant" value={linkedMunicipality?.name ?? "noch nicht angelegt"} />
                <StatusPill label="Missionen" value={`${linkedMissions.length}`} />
              </div>
              {isDistrictFocusMode && (
                <div className="gemeindeSharePanel">
                  <div>
                    <span>{selectedGemeinde ? "Ausgewählte Gemeinde" : "Gemeindeebene"}</span>
                    <strong>
                      {selectedGemeinde
                        ? `${selectedGemeinde.properties.gemeinde_name} · ${(selectedGemeinde.properties.einwohner_zensus ?? 0).toLocaleString("de-DE")} Einwohner`
                        : gemeindenLoadState === "ready"
                        ? `${gemeinden?.features.length ?? 0} Gemeinden · ${gemeindePopulationTotal.toLocaleString("de-DE")} Einwohner`
                        : gemeindenLoadState === "loading"
                          ? "Gemeinden werden geladen"
                          : "Gemeinden nicht verfügbar"}
                    </strong>
                  </div>
                  {(selectedGemeinde ? [selectedGemeinde] : topGemeinden).map((feature) => {
                    const population = feature.properties.einwohner_zensus ?? 0;
                    const share = gemeindePopulationTotal > 0 ? Math.round((population / gemeindePopulationTotal) * 100) : 0;
                    return (
                      <div key={feature.properties.gemeinde_id} className="gemeindeShareRow">
                        <span>{feature.properties.gemeinde_name}</span>
                        <strong>{share}%</strong>
                      </div>
                    );
                  })}
                </div>
              )}
              {isDistrictFocusMode && <div className="forestDrawPanel forestAveragePanel">
                <div><span>Zeitbezogener Waldzustand</span><strong>Routendurchschnitt auf Waldfläche projizieren</strong></div>
                <label className="fieldLabel"><span><input type="checkbox" checked={showForestAverages} onChange={(event) => setShowForestAverages(event.target.checked)} /> Flächenfärbung anzeigen</span></label>
                <label className="fieldLabel">Zeitraum
                  <select value={forestAveragePeriodMode} onChange={(event) => { setForestAveragePeriodMode(event.target.value as "month" | "quarter"); setSelectedForestAveragePeriod(""); }}>
                    <option value="month">Monat</option><option value="quarter">Quartal</option>
                  </select>
                </label>
                <label className="fieldLabel">Periode
                  <select value={activeForestAveragePeriod} onChange={(event) => setSelectedForestAveragePeriod(event.target.value)} disabled={availableForestAveragePeriods.length === 0}>
                    {availableForestAveragePeriods.length === 0 ? <option value="">Noch keine gespeicherten Werte</option> : availableForestAveragePeriods.map((period) => <option key={period} value={period}>{formatMissionPeriod(period)}</option>)}
                  </select>
                </label>
                <small>Je Waldgebiet wird der zuletzt gespeicherte Missionswert der Periode gezeigt. Die Farbe ist aus dem befahrenen Weg abgeleitet und keine flächendeckende Messung.</small>
              </div>}
              {canManage && isDistrictFocusMode && (
                <div className="forestDrawPanel">
                  <div>
                    <span>Einsatzgebiet abgrenzen</span>
                    <strong>{currentForestScope.name}</strong>
                  </div>
                  <label className="fieldLabel">
                    Zuständige Portal-Gemeinde
                    <select value={drawingMunicipalityId} onChange={(event) => {
                      const municipalityId = event.target.value;
                      setDrawingMunicipalityId(municipalityId);
                      onSelectMunicipalityContext(municipalityId || null);
                      setMapManagementError(municipalityId ? null : "Bitte eine Gemeinde auswählen.");
                    }}>
                      <option value="">Nicht zugeordnet – Speichern blockiert</option>
                      {municipalities.filter((item) => item.status !== "archived").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  {mapManagementError && <p className="inlineError" role="alert">{mapManagementError}</p>}
                  <label className="fieldLabel">
                    Gebietsname
                    <input value={draftForestName} onChange={(event) => setDraftForestName(event.target.value)} />
                  </label>
                  <div className="forestDrawActions">
                    <button className={`commandButton ${isForestDrawingEnabled ? "active" : ""}`} onClick={() => setIsForestDrawingEnabled((enabled) => !enabled)} type="button">
                      <MapPinned size={16} />
                      Zeichnen
                    </button>
                    <button className="commandButton" onClick={() => setDraftForestPolygon((current) => current.slice(0, -1))} disabled={draftForestPolygon.length === 0} type="button">
                      <Undo2 size={16} />
                      Punkt
                    </button>
                    <button className="commandButton primary" onClick={saveDraftForest} disabled={draftForestPolygon.length < 3} type="button">
                      <Save size={16} />
                      Speichern
                    </button>
                  </div>
                  <small>{draftForestPolygon.length} Punkte in aktueller Zeichnung</small>
                  <div className="forestAreaList">
                    {visibleForestAreas.length === 0 ? (
                      <span>Noch keine Einsatzgebiete in dieser Ebene.</span>
                    ) : (
                      visibleForestAreas.map((area) => (
                        <div key={area.id} className={area.id === selectedAreaId ? "selected" : ""}>
                          <span className="forestAreaListHeader">
                            <button className="forestAreaSelect" onClick={() => selectOrOpenArea(area)} type="button"><strong>{area.name}</strong></button>
                            <button className="iconButton danger" onClick={() => void onArchiveArea(area.id)} type="button" aria-label={`${area.name} archivieren`}>
                              <FolderOpen size={14} />
                            </button>
                          </span>
                          <small>{area.boundaryStatus === "pending" ? "Grenze ausstehend" : `${area.hectares.toLocaleString("de-DE")} ha`} · {area.status} · {area.scopeName}</small>
                          <button className="textButton" onClick={() => beginAreaRedraw(area)} type="button">{area.boundaryStatus === "pending" ? "Grenze auf Karte einzeichnen" : "Grenze/Name bearbeiten"}</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div className="adminDistrictActions">
                <button className="commandButton primary" onClick={onOpenGeo} disabled={!selectedManagedArea || selectedManagedArea.boundaryStatus === "pending"} type="button">
                  <MapPinned size={16} />
                  Gebiet in GeoID öffnen
                </button>
                <button className="commandButton" onClick={onBackToPortal} type="button">
                  <ArrowLeft size={16} />
                  Im Portal öffnen
                </button>
              </div>
              <p className="adminMapSource">
                Grenzdaten: deutschlandGeoJSON, gefiltert auf Baden-Württemberg. Für Produktion sollte hier ein amtlicher WFS/GeoJSON-Endpunkt des Landes oder ein versionierter eigener Import genutzt werden.
              </p>
            </>
          ) : (
            <p className="emptyRecordHistory">Noch kein Verwaltungsgebiet ausgewählt.</p>
          )}
        </aside>
      </main>
    </div>
  );
}

function MissionOverviewPage({
  canManage,
  scenarioName,
  missionId,
  vehicle,
  forestAreaName,
  pathName,
  seed,
  generatorVersion,
  copernicus,
  overview,
  observations,
  speciesObservations,
  biodiversityMetrics,
  indexDefinitions,
  records,
  onSaveRecord,
  onExportCurrentRecord,
  onExportRecord,
  onDeleteRecord,
  onBack,
}: {
  canManage: boolean;
  scenarioName: string;
  missionId: string;
  vehicle: string;
  forestAreaName: string;
  pathName: string;
  seed: string;
  generatorVersion: string;
  copernicus: CopernicusAnalysis;
  overview: MissionOverview;
  observations: Observation[];
  speciesObservations: SpeciesObservationRecord[];
  biodiversityMetrics: BiodiversityMetrics;
  indexDefinitions: IndexDefinitionDemo[];
  records: MissionRecord[];
  onSaveRecord: () => Promise<void>;
  onExportCurrentRecord: () => void;
  onExportRecord: (record: MissionRecord) => void;
  onDeleteRecord: (recordId: string) => void;
  onBack: () => void;
}) {
  const rawRows = observations.filter((_, index) => index % 18 === 0 || index === observations.length - 1).slice(0, 9);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const saveRecord = async () => {
    setSaveState("saving");
    try {
      await onSaveRecord();
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  };

  return (
    <div className="recordPage">
      <header className="recordHeader">
        <button className="backButton" onClick={onBack} type="button">
          <ArrowLeft size={18} />
          Zurück zur Karte
        </button>
        <div>
          <p className="eyebrow">Mission Record</p>
          <h1>{scenarioName || "Athene Szenario"}</h1>
          <p className="recordSubline">
            {forestAreaName} · {pathName} · {vehicle}
          </p>
        </div>
        {canManage && <button className="recordSaveButton" onClick={saveRecord} type="button" disabled={saveState === "saving"}>
          <Save size={17} />
          {saveState === "saving" ? "Speichert..." : saveState === "saved" ? "Gespeichert" : saveState === "failed" ? "API nicht erreichbar" : "Record speichern"}
        </button>}
        <button className="recordExportButton" onClick={onExportCurrentRecord} type="button">
          <Download size={17} />
          Export
        </button>
      </header>

      <main className="recordContent">
        <section className={`conditionHero ${overview.drynessTone}`}>
          <div>
            <p className="eyebrow">Missionsüberblick · synthetisch/simuliert</p>
            <h2>{overview.drynessLabel}</h2>
            <p>{overview.generatedSummary}</p>
          </div>
          <div className="conditionScore">
            <span>Trockenstress</span>
            <strong>{Math.round(overview.averageDryStress * 100)}%</strong>
            <small>Maximum {Math.round(overview.maxDryStress * 100)}%</small>
          </div>
        </section>

        <section className="recordMetricGrid">
          <OverviewMetric label="Trocken-Hotspots" value={`${overview.dryHotspots}`} detail="Punkte mit erhöhtem Screeningwert" />
          <OverviewMetric label="Temperatur" value={`${overview.averageTemperature.toFixed(1)} °C`} detail={`Maximum ${overview.maxTemperature.toFixed(1)} °C`} />
          <OverviewMetric label="Luftfeuchte" value={`${overview.averageHumidity.toFixed(1)}%`} detail={`Minimum ${overview.minHumidity.toFixed(1)}%`} />
          <OverviewMetric label="Confidence" value={`${Math.round(overview.averageConfidence * 100)}%`} detail={`${Math.round(overview.lowConfidenceShare * 100)}% niedrige Confidence`} />
          <OverviewMetric label="Luftbelastung" value={overview.airLoadLabel} detail={`Score ${Math.round(overview.airLoadScore * 100)}%`} />
          <OverviewMetric label="Kronen-/Lichtbild" value={overview.canopyLabel} detail={`${Math.round(overview.averageLuxCanopy)} lx mittleres Kronenlicht`} />
        </section>

        <section className="recordMetricGrid">
          <OverviewMetric label="Species Richness" value={`${biodiversityMetrics.richness}`} detail="Taxa mit gültiger Mindestconfidence" />
          <OverviewMetric label="Shannon" value={biodiversityMetrics.shannon.toFixed(2)} detail={`Simpson ${biodiversityMetrics.simpson.toFixed(2)}`} />
          <OverviewMetric label="Audioaktivität" value={`${biodiversityMetrics.acousticActivityRate}`} detail="gültige Audioevents je Stunde" />
          <OverviewMetric label="Native Plant Share" value={`${Math.round(biodiversityMetrics.nativePlantShare * 100)}%`} detail="nur sichtbarer Messkorridor" />
          <OverviewMetric label="Sensible Taxa" value={`${biodiversityMetrics.sensitiveObservationCount}`} detail="Bürgeransicht vergröbern" />
          <OverviewMetric label="Indexstatus" value="EXPERIMENTAL" detail="Formelversion erforderlich" />
        </section>

        <section className="recordColumns">
          <div className="recordPanel">
            <PanelTitle icon={<Sprout size={18} />} title="Waldbestand und Struktur" />
            <DetectionList title="Baum-/Strukturhinweise" items={overview.treeDetections} empty="Keine dominanten Baumdetektionen" />
            <DetectionList title="Stress-/Schadbilder" items={overview.damageDetections} empty="Keine eindeutigen Schadbilder" />
            <DetectionList title="Bioakustik" items={overview.birdDetections} empty="Keine Vogelereignisse im Ausschnitt" />
          </div>

          <div className="recordPanel">
            <PanelTitle icon={<ShieldCheck size={18} />} title="Bewertung und Governance" />
            <div className="governanceList">
              <StatusPill label="Mission" value={missionId} />
              <StatusPill label="Seed" value={seed} />
              <StatusPill label="Generator" value={generatorVersion} />
              <StatusPill label="Datenstatus" value="synthetic / simulated" />
            </div>
            <p className="notice">
              Dieser Record ist ein automatisch generierter Screening-Überblick aus Mock-Daten. Er ersetzt keine fachliche Freigabe und keine validierte Warnlogik.
            </p>
          </div>
        </section>

        <section className="recordPanel">
          <PanelTitle icon={<Satellite size={18} />} title="Copernicus Kontext" />
          <div className="copernicusRecordGrid">
            <OverviewMetric label="NDVI" value={copernicus.ndviMean.toFixed(2)} detail={copernicus.vegetationLabel} />
            <OverviewMetric label="NDMI" value={copernicus.ndmiMean.toFixed(2)} detail={copernicus.moistureLabel} />
            <OverviewMetric label="NBR" value={copernicus.nbrMean.toFixed(2)} detail={copernicus.disturbanceLabel} />
            <OverviewMetric label="Szene" value={copernicus.scene.date} detail={`${copernicus.scene.cloudCover}% Wolken · ${Math.round(copernicus.confidence * 100)}% Confidence`} />
          </div>
          <p className="copernicusRecordNote">
            Sentinel-2 liefert den großflächigen Vegetationskontext. Die UGV-Mission bleibt die bodennahe Detailquelle; Abweichungen zwischen beiden Quellen werden als Prüfhinweis behandelt.
          </p>
        </section>

        <section className="recordPanel">
          <PanelTitle icon={<Sprout size={18} />} title="Artenbeobachtungen" />
          <div className="speciesObservationList">
            {speciesObservations.slice(0, 8).map((record) => {
              const taxon = findTaxon(record.taxonId);
              return (
                <div key={record.id} className="speciesObservationRow">
                  <div>
                    <strong>{taxon?.germanName ?? record.taxonId}</strong>
                    <span>{taxon?.scientificName ?? "Taxon"} - {record.evidenceType} - {record.detectionStatus}</span>
                  </div>
                  <small>{Math.round(record.probability * 100)}% / Schwelle {Math.round(record.decisionThreshold * 100)}%</small>
                  <small>{record.reviewerStatus}</small>
                </div>
              );
            })}
          </div>
          <p className="copernicusRecordNote">
            Modellkandidaten sind noch keine bestaetigten Artnachweise. Schutzrelevante Arten bleiben bis zur fachlichen Review intern oder raeumlich vergroessert.
          </p>
        </section>

        <section className="recordPanel">
          <PanelTitle icon={<BarChart3 size={18} />} title="Index Builder Preview" />
          <div className="indexDefinitionList">
            {indexDefinitions.map((definition) => (
              <div key={definition.indexCode} className="indexDefinitionRow">
                <div>
                  <strong>{definition.name}</strong>
                  <span>{definition.indexCode} - v{definition.version} - {definition.status}</span>
                </div>
                <small>{definition.output}</small>
                <p>{definition.interpretationLimit}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="recordPanel">
          <PanelTitle icon={<ClipboardList size={18} />} title="Record-Verlauf" />
          {records.length === 0 ? (
            <p className="emptyRecordHistory">Noch kein persistierter Record für diese Mission.</p>
          ) : (
            <div className="recordHistoryList">
              {records.map((record) => (
                <div key={record.id} className="recordHistoryRow">
                  <div>
                    <strong>{new Date(record.createdAt).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</strong>
                    <span>{record.summary}</span>
                  </div>
                  <button className="iconButton" aria-label="Record exportieren" title="Record exportieren" onClick={() => onExportRecord(record)} type="button">
                    <Download size={16} />
                  </button>
                  {canManage && <button className="iconButton danger" aria-label="Record löschen" title="Record löschen" onClick={() => onDeleteRecord(record.id)} type="button">
                    <Trash2 size={16} />
                  </button>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="recordPanel">
          <PanelTitle icon={<Activity size={18} />} title="Empfohlene nächste Prüfung" />
          <div className="recommendationList">
            {overview.recommendations.map((recommendation) => (
              <div key={recommendation} className="recommendationItem">
                {recommendation}
              </div>
            ))}
          </div>
        </section>

        <section className="recordPanel">
          <PanelTitle icon={<BarChart3 size={18} />} title="Rohdaten-Auszug" />
          <div className="rawTable">
            <div className="rawTableHeader">
              <span>Min</span>
              <span>Temp</span>
              <span>RH</span>
              <span>CO2</span>
              <span>VOC</span>
              <span>PM2.5</span>
              <span>Stress</span>
              <span>Conf.</span>
            </div>
            {rawRows.map((observation) => (
              <div key={observation.id} className="rawTableRow">
                <span>{Math.round(observation.minute)}</span>
                <span>{observation.values.temperature.toFixed(1)}</span>
                <span>{observation.values.humidity.toFixed(1)}</span>
                <span>{observation.values.co2}</span>
                <span>{observation.values.voc}</span>
                <span>{observation.values.pm25.toFixed(1)}</span>
                <span>{observation.values.dryStress.toFixed(2)}</span>
                <span>{observation.confidence.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function OverviewMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="overviewMetric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function NumberInput({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const displayValue = step >= 1 ? Math.round(value).toString() : value.toFixed(2);
  return (
    <label className="builderInput">
      <span>
        {label}
        <strong>{displayValue} {unit}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <input type="number" min={min} max={max} step={step} value={Number.isInteger(step) ? Math.round(value) : value} onChange={(event) => onChange(clamp(Number(event.target.value), min, max))} />
    </label>
  );
}

function ValidationRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`validationRow ${ok ? "ok" : "warn"}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function iconForHyperionType(type: HyperionMapItem["type"]): ReactNode {
  if (type === "tool") return <Wrench size={16} />;
  if (type === "file") return <FileText size={16} />;
  if (type === "report") return <ClipboardList size={16} />;
  return <Layers size={16} />;
}

function colorForHyperionType(type: HyperionMapItem["type"]): string {
  if (type === "tool") return "#0f766e";
  if (type === "file") return "#2563eb";
  if (type === "report") return "#b45309";
  return "#7c3aed";
}

function DetectionList({ title, items, empty }: { title: string; items: Array<{ label: string; count: number }>; empty: string }) {
  return (
    <div className="detectionList">
      <span>{title}</span>
      {items.length === 0 ? (
        <strong>{empty}</strong>
      ) : (
        items.map((item) => (
          <strong key={item.label}>
            {item.label} · {item.count}
          </strong>
        ))
      )}
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panelTitle">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="fieldLabel">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RangeField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="rangeLabel">
      <span>
        {label}
        <strong>{Math.round(value * 100)}%</strong>
      </span>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="statusPill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricGrid({ observation, activeLayerId, selectedCell }: { observation: Observation; activeLayerId: LayerId; selectedCell: CoverageCell | null }) {
  const activeLayer = getLayerDefinition(activeLayerId);
  const value = selectedCell?.value ?? getLayerValue(observation, activeLayerId);

  return (
    <div className="metricGrid">
      <Metric label={activeLayer.name} value={value === null ? "unbekannt" : `${formatValue(value ?? 0, activeLayer)} ${activeLayer.unit}`} />
      <Metric label="Confidence" value={`${Math.round((selectedCell?.confidence ?? observation.confidence) * 100)}%`} />
      <Metric label="Status" value={selectedCell?.dataStatus ?? observation.dataStatus} />
      <Metric label="Origin" value={selectedCell?.dataOrigin ?? observation.dataOrigin} />
      <Metric label="Zeit" value={new Date(selectedCell?.timestamp ?? observation.timestamp).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })} />
      <Metric label="Distanz" value={`${selectedCell?.distanceToRouteMeters ?? 0} m`} />
      <Metric label="Quelle" value={selectedCell ? `${selectedCell.source} · Referenz ${selectedCell.sourceObservationId}` : observation.source} wide />
      <Metric label="Modell" value={selectedCell?.modelVersion ?? (activeLayerId === "dryStress" ? dryStressIndicator.version : observation.generatorVersion)} wide />
      <div className="detectionBox">
        <span>Detektionen</span>
        {observation.detections.length === 0 ? (
          <strong>keine</strong>
        ) : (
          observation.detections.map((detection) => (
            <strong key={`${detection.type}-${detection.label}`}>
              {detection.label} · {Math.round(detection.confidence * 100)}%
            </strong>
          ))
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`metric ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function UseCaseRow({ label, value, tone }: { label: string; value: string; tone: "danger" | "warn" | "neutral" }) {
  return (
    <div className={`useCaseRow ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Phase({ label, value }: { label: string; value: string }) {
  return (
    <div className="phase">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function toLatLng(point: { lat: number; lng: number }): [number, number] {
  return [point.lat, point.lng];
}

function buildIndexBuilderValues({
  overview,
  biodiversityMetrics,
  copernicus,
  liveWeather,
}: {
  overview: MissionOverview;
  biodiversityMetrics: BiodiversityMetrics;
  copernicus: CopernicusAnalysis;
  liveWeather: LiveWeather;
}): IndexBuilderValues {
  return {
    temperature: Number.isFinite(liveWeather.temperature) ? liveWeather.temperature : overview.averageTemperature,
    humidity: Number.isFinite(liveWeather.humidity) ? liveWeather.humidity : overview.averageHumidity,
    dryStress: overview.averageDryStress,
    confidence: overview.averageConfidence,
    speciesRichness: biodiversityMetrics.richness,
    shannon: biodiversityMetrics.shannon,
    acousticActivityRate: biodiversityMetrics.acousticActivityRate,
    nativePlantShare: biodiversityMetrics.nativePlantShare,
    ndvi: copernicus.ndviMean,
    ndmi: copernicus.ndmiMean,
    nbr: copernicus.nbrMean,
    climateWeight: 0.42,
    biodiversityWeight: 0.34,
    satelliteWeight: 0.24,
  };
}

function buildAvailableIndexInputs(values: IndexBuilderValues): Array<{ id: string; label: string; group: string; value: string }> {
  return [
    { id: "temperature", label: "Temperatur", group: "Live Wetter / Mission", value: `${values.temperature.toFixed(1)} °C` },
    { id: "humidity", label: "Luftfeuchte", group: "Live Wetter / Mission", value: `${Math.round(values.humidity)}%` },
    { id: "dryStress", label: "Trockenstress", group: "Missionsindex", value: values.dryStress.toFixed(2) },
    { id: "confidence", label: "Observation Confidence", group: "Datenqualität", value: values.confidence.toFixed(2) },
    { id: "speciesRichness", label: "Species Richness", group: "Artenwissen", value: `${Math.round(values.speciesRichness)} Taxa` },
    { id: "shannon", label: "Shannon Diversität", group: "Artenwissen", value: values.shannon.toFixed(2) },
    { id: "acousticActivityRate", label: "Audioaktivität", group: "Bioakustik", value: `${values.acousticActivityRate.toFixed(1)} Events/h` },
    { id: "nativePlantShare", label: "Native Plant Share", group: "Pflanzen", value: `${Math.round(values.nativePlantShare * 100)}%` },
    { id: "ndvi", label: "NDVI", group: "Copernicus", value: values.ndvi.toFixed(2) },
    { id: "ndmi", label: "NDMI", group: "Copernicus", value: values.ndmi.toFixed(2) },
    { id: "nbr", label: "NBR", group: "Copernicus", value: values.nbr.toFixed(2) },
  ];
}

function calculateClimateIndex(values: IndexBuilderValues): number {
  const temperatureScore = normalize(values.temperature, 18, 36) * 100;
  const dryAirScore = (1 - normalize(values.humidity, 28, 86)) * 100;
  const stressScore = values.dryStress * 100;
  return Math.round(clamp01(values.confidence) * (temperatureScore * 0.35 + dryAirScore * 0.3 + stressScore * 0.35));
}

function calculateBiodiversityIndex(values: IndexBuilderValues): number {
  const richnessScore = normalize(values.speciesRichness, 2, 18) * 100;
  const shannonScore = normalize(values.shannon, 0.3, 2.6) * 100;
  const activityScore = normalize(values.acousticActivityRate, 0, 24) * 100;
  const nativeScore = values.nativePlantShare * 100;
  return Math.round(richnessScore * 0.28 + shannonScore * 0.28 + activityScore * 0.18 + nativeScore * 0.26);
}

function calculateSatelliteIndex(values: IndexBuilderValues): number {
  const lowVegetationScore = (1 - normalize(values.ndvi, 0.25, 0.78)) * 100;
  const moistureStressScore = (1 - normalize(values.ndmi, -0.2, 0.42)) * 100;
  const disturbanceScore = (1 - normalize(values.nbr, 0.08, 0.72)) * 100;
  return Math.round(lowVegetationScore * 0.3 + moistureStressScore * 0.38 + disturbanceScore * 0.32);
}

function normalizeWeights(climateWeight: number, biodiversityWeight: number, satelliteWeight: number): { climate: number; biodiversity: number; satellite: number } {
  const sum = climateWeight + biodiversityWeight + satelliteWeight;
  if (sum <= 0) return { climate: 1 / 3, biodiversity: 1 / 3, satellite: 1 / 3 };
  return {
    climate: climateWeight / sum,
    biodiversity: biodiversityWeight / sum,
    satellite: satelliteWeight / sum,
  };
}

function centroidOf(points: Coordinate[]): Coordinate {
  if (points.length === 0) return { lat: 48.7468, lng: 9.2702 };
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
}

function buildCellBounds(cells: CoverageCell[]): Map<string, [[number, number], [number, number]]> {
  if (cells.some((cell) => cell.id.includes("-corridor-"))) {
    return new Map(
      cells.map((cell) => {
        const halfLat = metersToLatDegrees(4);
        const halfLng = metersToLngDegrees(4, cell.lat);
        return [
          cell.id,
          [
            [cell.lat - halfLat, cell.lng - halfLng],
            [cell.lat + halfLat, cell.lng + halfLng],
          ],
        ];
      }),
    );
  }

  const latStep = findGridStep(cells.map((cell) => cell.lat)) || 0.00042;
  const lngStep = findGridStep(cells.map((cell) => cell.lng)) || 0.00042;
  return new Map(
    cells.map((cell) => [
      cell.id,
      [
        [cell.lat - latStep / 2, cell.lng - lngStep / 2],
        [cell.lat + latStep / 2, cell.lng + lngStep / 2],
      ],
    ]),
  );
}

function metersToLatDegrees(meters: number): number {
  return meters / 111_320;
}

function metersToLngDegrees(meters: number, lat: number): number {
  return meters / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
}

function calculateFeatureBounds(feature: { geometry: unknown }): [[number, number], [number, number]] | null {
  const coordinates = collectGeometryCoordinates(feature.geometry);
  if (coordinates.length === 0) return null;
  const lats = coordinates.map((coordinate) => coordinate.lat);
  const lngs = coordinates.map((coordinate) => coordinate.lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

function calculateFeaturesBounds(features: Array<{ geometry: unknown }>): [[number, number], [number, number]] | null {
  return calculateCoordinateBounds(features.flatMap((feature) => collectGeometryCoordinates(feature.geometry)));
}

function findMunicipalityForDistrict(municipalities: Municipality[], district: BadenWuerttembergDistrictFeature, areas: DeploymentArea[]): Municipality | null {
  const scopeId = `kreis-${district.properties.ID_3}`;
  const byScope = municipalities.find((item) => item.administrativeScopeId === scopeId)
    ?? municipalities.find((item) => areas.some((area) => area.scopeId === scopeId && area.municipalityId === item.id));
  if (byScope) return byScope;
  const districtName = district.properties.NAME_3.toLocaleLowerCase("de-DE");
  return municipalities.find((item) => item.region.toLocaleLowerCase("de-DE").includes(districtName)) ?? null;
}

function geometryContainsCoordinate(geometry: unknown, point: Coordinate): boolean {
  if (!geometry || typeof geometry !== "object" || !("coordinates" in geometry)) return false;
  const rings: Array<Array<[number, number]>> = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 3 && Array.isArray(value[0]) && typeof value[0][0] === "number" && typeof value[0][1] === "number") {
      rings.push(value as Array<[number, number]>);
      return;
    }
    value.forEach(visit);
  };
  visit((geometry as { coordinates: unknown }).coordinates);
  return rings.some((ring) => {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
      const [lng, lat] = ring[index];
      const [previousLng, previousLat] = ring[previous];
      const intersects = lng > point.lng !== previousLng > point.lng && point.lat < ((previousLat - lat) * (point.lng - lng)) / (previousLng - lng) + lat;
      if (intersects) inside = !inside;
    }
    return inside;
  });
}

function calculateCoordinateBounds(coordinates: Coordinate[]): [[number, number], [number, number]] | null {
  if (coordinates.length === 0) return null;
  return [
    [Math.min(...coordinates.map((coordinate) => coordinate.lat)), Math.min(...coordinates.map((coordinate) => coordinate.lng))],
    [Math.max(...coordinates.map((coordinate) => coordinate.lat)), Math.max(...coordinates.map((coordinate) => coordinate.lng))],
  ];
}

function collectGeometryCoordinates(geometry: unknown): Coordinate[] {
  if (!geometry || typeof geometry !== "object" || !("coordinates" in geometry)) return [];
  const rawCoordinates = (geometry as { coordinates: unknown }).coordinates;
  const coordinates: Coordinate[] = [];

  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      coordinates.push({ lng: value[0], lat: value[1] });
      return;
    }
    value.forEach(visit);
  };

  visit(rawCoordinates);
  return coordinates;
}

function buildGemeindeWfsUrl(kreisName: string): string {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "nora:v_gemeinde",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    CQL_FILTER: `kreis_name='${escapeCqlString(kreisName)}'`,
  });
  return `${administrativeWfsUrl}?${params.toString()}`;
}

function escapeCqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function findGridStep(values: number[]): number {
  const sorted = Array.from(new Set(values.map((value) => round(value, 7)))).sort((a, b) => a - b);
  const deltas = sorted
    .slice(1)
    .map((value, index) => round(value - sorted[index], 7))
    .filter((value) => value > 0);
  return deltas.length === 0 ? 0 : Math.min(...deltas);
}

function createMissionRecord({
  missionId,
  areaId,
  municipalityId,
  scenarioName,
  forestAreaName,
  pathName,
  seed,
  generatorVersion,
  missionStartedAt,
  missionCompletedAt,
  coverageShare,
  overview,
  copernicus,
  biodiversityMetrics,
  observations,
  missionPath,
  scenarioParams,
  existingCreatedAt,
}: {
  missionId: string;
  areaId: string;
  municipalityId: string;
  scenarioName: string;
  forestAreaName: string;
  pathName: string;
  seed: string;
  generatorVersion: string;
  missionStartedAt: string;
  missionCompletedAt: string;
  coverageShare: number | null;
  overview: MissionOverview;
  copernicus: CopernicusAnalysis;
  biodiversityMetrics: BiodiversityMetrics;
  observations: Observation[];
  missionPath: MissionPath;
  scenarioParams: ScenarioParams;
  existingCreatedAt?: string;
}): MissionRecord {
  const timestamp = new Date().toISOString();
  const persistedObservations = observations.map((observation) => ({ ...structuredClone(observation), missionId }));
  return {
    id: `mission-result-${missionId}`,
    missionId,
    areaId,
    municipalityId,
    scenarioName: scenarioName || "Athene Szenario",
    forestAreaName,
    pathName,
    createdAt: existingCreatedAt ?? timestamp,
    missionStartedAt,
    missionCompletedAt,
    surveyedAt: missionCompletedAt,
    seed,
    generatorVersion,
    summary: overview.generatedSummary,
    metrics: {
      averageDryStress: overview.averageDryStress,
      maxDryStress: overview.maxDryStress,
      dryHotspots: overview.dryHotspots,
      averageTemperature: overview.averageTemperature,
      averageHumidity: overview.averageHumidity,
      averageConfidence: overview.averageConfidence,
      copernicusNdvi: copernicus.ndviMean,
      copernicusNdmi: copernicus.ndmiMean,
      copernicusNbr: copernicus.nbrMean,
      copernicusScene: copernicus.scene.id,
      speciesRichness: biodiversityMetrics.richness,
      shannonDiversity: biodiversityMetrics.shannon,
      simpsonDiversity: biodiversityMetrics.simpson,
      acousticActivityRate: biodiversityMetrics.acousticActivityRate,
      sensitiveObservationCount: biodiversityMetrics.sensitiveObservationCount,
    },
    recommendations: overview.recommendations,
    dataOrigin: "synthetic",
    dataStatus: "derived",
    confidence: overview.averageConfidence,
    source: `Athene Mock Generator ${generatorVersion}`,
    coverageShare,
    unknownShare: coverageShare === null ? null : round(1 - coverageShare, 3),
    linkageStatus: areaId && municipalityId ? "linked" : "review-needed",
    observations: persistedObservations,
    detections: persistedObservations.flatMap((observation) => observation.detections.map((detection) => ({
      ...detection,
      observationId: observation.id,
      lat: observation.lat,
      lng: observation.lng,
      timestamp: observation.timestamp,
      dataOrigin: observation.dataOrigin,
      dataStatus: observation.dataStatus,
      source: observation.source,
      modelVersion: observation.generatorVersion,
    }))),
    missionPath,
    scenarioParams,
    resultVersion: 1,
    updatedAt: timestamp,
  };
}

function buildMissionOverview(observations: Observation[], coverage: CoverageCell[], copernicus: CopernicusAnalysis): MissionOverview {
  const averageDryStress = average(observations.map((observation) => observation.values.dryStress));
  const maxDryStress = Math.max(...observations.map((observation) => observation.values.dryStress));
  const dryHotspots = observations.filter((observation) => observation.values.dryStress >= 0.68 && observation.confidence >= 0.58).length;
  const averageTemperature = average(observations.map((observation) => observation.values.temperature));
  const maxTemperature = Math.max(...observations.map((observation) => observation.values.temperature));
  const averageHumidity = average(observations.map((observation) => observation.values.humidity));
  const minHumidity = Math.min(...observations.map((observation) => observation.values.humidity));
  const averageConfidence = average(observations.map((observation) => observation.confidence));
  const lowConfidenceShare = coverage.length === 0 ? 0 : coverage.filter((cell) => cell.confidence < 0.5).length / coverage.length;
  const unknownShare = coverage.length === 0 ? 0 : coverage.filter((cell) => cell.dataStatus === "unknown" || cell.value === null).length / coverage.length;
  const airLoadScore = clamp01(
    average(observations.map((observation) => normalize(observation.values.voc, 70, 260) * 0.34 + normalize(observation.values.pm25, 2, 42) * 0.33 + normalize(observation.values.co2, 390, 560) * 0.33)),
  );
  const averageLuxCanopy = average(observations.map((observation) => observation.values.luxCanopy));
  const treeDetections = countDetections(observations, "tree");
  const damageDetections = countDetections(observations, "damage");
  const birdDetections = countDetections(observations, "bird");
  const drynessTone: MissionOverview["drynessTone"] = averageDryStress >= 0.68 || dryHotspots > 24 ? "risk" : averageDryStress >= 0.45 ? "watch" : "good";
  const drynessLabel = drynessTone === "risk" ? "Erhöhter Trockenstress in Teilbereichen" : drynessTone === "watch" ? "Beobachtbarer Trockenstress, fachlich prüfen" : "Keine dominante Trockenstresslage";
  const airLoadLabel = airLoadScore >= 0.66 ? "auffällig" : airLoadScore >= 0.4 ? "moderat" : "unauffällig";
  const canopyLabel = averageLuxCanopy >= 42000 ? "offene Kronenbereiche" : averageLuxCanopy >= 22000 ? "gemischte Kronendichte" : "dichte Kronenstruktur";
  const recommendations = buildRecommendations(drynessTone, airLoadScore, lowConfidenceShare, damageDetections.length, treeDetections.length, copernicus);

  return {
    drynessLabel,
    drynessTone,
    averageDryStress,
    maxDryStress,
    dryHotspots,
    averageTemperature,
    maxTemperature,
    averageHumidity,
    minHumidity,
    averageConfidence,
    lowConfidenceShare,
    unknownShare,
    airLoadLabel,
    airLoadScore,
    canopyLabel,
    averageLuxCanopy,
    treeDetections,
    damageDetections,
    birdDetections,
    generatedSummary: buildGeneratedSummary(drynessLabel, averageDryStress, maxDryStress, airLoadLabel, canopyLabel, averageConfidence, copernicus),
    recommendations,
  };
}

function buildGeneratedSummary(drynessLabel: string, averageDryStress: number, maxDryStress: number, airLoadLabel: string, canopyLabel: string, averageConfidence: number, copernicus: CopernicusAnalysis): string {
  return `${drynessLabel}. Der mittlere interne Trockenstressindex liegt bei ${Math.round(averageDryStress * 100)}%, mit lokalen Spitzen bis ${Math.round(maxDryStress * 100)}%. Die Luftbelastung wirkt im Missionsausschnitt ${airLoadLabel}; das Lichtbild spricht für ${canopyLabel}. Copernicus Sentinel-2 ergänzt den Kontext mit ${copernicus.vegetationLabel} und ${copernicus.moistureLabel}. Die mittlere Observation Confidence liegt bei ${Math.round(averageConfidence * 100)}%, daher sollten Aussagen außerhalb des Messkorridors weiterhin vorsichtig behandelt werden.`;
}

function buildRecommendations(drynessTone: MissionOverview["drynessTone"], airLoadScore: number, lowConfidenceShare: number, damageKinds: number, treeKinds: number, copernicus: CopernicusAnalysis): string[] {
  const recommendations = [
    "Hotspot-Bereiche in der Master Map fachlich gegenprüfen und nicht als automatische Warnung veröffentlichen.",
    "Unbekannte oder niedrig abgesicherte Flächen in Folgefahrten gezielt nachverdichten.",
  ];

  if (drynessTone === "risk") recommendations.unshift("Zusätzliche Feuchte-, Wetter- und Brennstoffdaten für die auffälligen Trockenstressbereiche einholen.");
  if (airLoadScore >= 0.4) recommendations.push("VOC-, PM- und CO2-Ausreißer entlang der Route mit Wetterlage und möglichen lokalen Quellen abgleichen.");
  if (damageKinds > 0) recommendations.push("Detektierte Schadbilder als Prüfauftrag markieren und nicht ungeprüft im Bürgermonitor anzeigen.");
  if (treeKinds === 0) recommendations.push("Vegetationsklassifikation in dieser Mission verbessern, da kaum Strukturhinweise erkannt wurden.");
  if (lowConfidenceShare > 0.25) recommendations.push("Messkorridor oder Route erweitern, weil ein relevanter Anteil der Coverage nur schwach abgesichert ist.");
  if (copernicus.ndmiMean < 0.05) recommendations.push("Copernicus NDMI weist auf Feuchtestress hin; betroffene Bereiche mit bodennahen Feuchte- und Vegetationsmessungen validieren.");
  if (copernicus.scene.cloudCover > 25) recommendations.push("Aktuellere oder wolkenärmere Sentinel-2-Szene suchen, bevor der Satellitenkontext für Freigaben genutzt wird.");

  return recommendations;
}

function countDetections(observations: Observation[], type: "tree" | "damage" | "bird"): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  observations.forEach((observation) => {
    observation.detections
      .filter((detection) => detection.type === type)
      .forEach((detection) => counts.set(detection.label, (counts.get(detection.label) ?? 0) + 1));
  });
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalize(value: number, min: number, max: number): number {
  return clamp01((value - min) / (max - min));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function buildForestPath(waypoints: Waypoint[], name: string): ForestPath {
  return {
    id: "forest-path-manual",
    name: name.trim() || "Manuell erfasster Weg",
    waypoints,
    driveability: "moderate",
    widthMeters: 2.6,
  };
}

function calculateRouteLengthMeters(points: Array<Coordinate & { breakBefore?: boolean }>): number {
  if (points.length < 2) return 0;
  return points.slice(1).reduce((sum, point, index) => point.breakBefore ? sum : sum + distanceBetweenCoordinatesMeters(points[index], point), 0);
}

function routeCoordinatesEqual(left: Coordinate[], right: Coordinate[]): boolean {
  return left.length === right.length && left.every((point, index) =>
    Math.abs(point.lat - right[index].lat) < 1e-9 && Math.abs(point.lng - right[index].lng) < 1e-9 &&
    Boolean((point as Waypoint).breakBefore) === Boolean((right[index] as Waypoint).breakBefore));
}

function composeRouteSegments(baseRoute: Coordinate[], segments: OsmForestPath[]): Array<Coordinate & { breakBefore?: boolean }> {
  const route: Array<Coordinate & { breakBefore?: boolean }> = baseRoute.map((point) => ({ lat: point.lat, lng: point.lng }));
  for (const segment of segments) {
    if (segment.coordinates.length < 2) continue;
    let oriented = segment.coordinates;
    if (route.length > 0) {
      const last = route[route.length - 1];
      const distanceToStart = distanceBetweenCoordinatesMeters(last, segment.coordinates[0]);
      const distanceToEnd = distanceBetweenCoordinatesMeters(last, segment.coordinates[segment.coordinates.length - 1]);
      if (distanceToEnd < distanceToStart) oriented = [...segment.coordinates].reverse();
      if (distanceBetweenCoordinatesMeters(last, oriented[0]) < 1) oriented = oriented.slice(1);
    }
    route.push(...oriented.map((point, index) => ({
      lat: point.lat,
      lng: point.lng,
      breakBefore: index === 0 && route.length > 0 && distanceBetweenCoordinatesMeters(route[route.length - 1], point) >= 3,
    })));
  }
  return route;
}

function distanceBetweenCoordinatesMeters(a: Coordinate, b: Coordinate): number {
  const radius = 6_371_000;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function formatRouteLength(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

function buildRouteAssessment(overview: MissionOverview): string {
  if (overview.averageConfidence < 0.55 || overview.lowConfidenceShare > 0.3) return "Datenlage prüfen";
  if (overview.maxDryStress >= 0.78 || overview.averageDryStress >= 0.65) return "kritisch";
  if (overview.maxDryStress >= 0.62 || overview.averageDryStress >= 0.48) return "beobachten";
  return "unauffällig";
}

function fitForestPathToArea(path: ForestPath, area: ForestArea): ForestPath {
  if (path.waypoints.length < 2 || area.polygon.length < 3) return path;
  const sourceCenter = centroidOf(path.waypoints);
  const targetCenter = centroidOf(area.polygon);
  const sourceLatSpan = Math.max(...path.waypoints.map((point) => point.lat)) - Math.min(...path.waypoints.map((point) => point.lat));
  const sourceLngSpan = Math.max(...path.waypoints.map((point) => point.lng)) - Math.min(...path.waypoints.map((point) => point.lng));
  const targetLatSpan = Math.max(...area.polygon.map((point) => point.lat)) - Math.min(...area.polygon.map((point) => point.lat));
  const targetLngSpan = Math.max(...area.polygon.map((point) => point.lng)) - Math.min(...area.polygon.map((point) => point.lng));
  const scale = Math.min(targetLatSpan / Math.max(sourceLatSpan, 0.00001), targetLngSpan / Math.max(sourceLngSpan, 0.00001)) * 0.58;
  return {
    ...path,
    id: `${path.id}-${area.id}`,
    name: `${area.name} Route`,
    waypoints: path.waypoints.map((point) => ({
      ...point,
      lat: targetCenter.lat + (point.lat - sourceCenter.lat) * scale,
      lng: targetCenter.lng + (point.lng - sourceCenter.lng) * scale,
    })),
  };
}

function buildForestAreaForPath(path: ForestPath, fallback: ForestArea): ForestArea {
  if (path.waypoints.length < 2) return fallback;

  const lats = path.waypoints.map((waypoint) => waypoint.lat);
  const lngs = path.waypoints.map((waypoint) => waypoint.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0008);
  const lngSpan = Math.max(maxLng - minLng, 0.0008);
  const latPadding = Math.max(0.001, latSpan * 0.45);
  const lngPadding = Math.max(0.001, lngSpan * 0.45);
  const routeLengthMeters = calculateRouteLengthMeters(path.waypoints);
  const hectares = Math.max(0.01, round((routeLengthMeters * measurementCorridorWidthMeters) / 10_000, 2));
  const center = centroidOf(path.waypoints);

  return {
    ...fallback,
    id: `manual-area-${path.waypoints.length}-${round(center.lat, 5)}-${round(center.lng, 5)}`,
    name: `${path.name} Messbereich`,
    hectares,
    authority: "Manuell erfasst / Demo",
    polygon: [
      { lat: minLat - latPadding, lng: minLng - lngPadding },
      { lat: maxLat + latPadding, lng: minLng - lngPadding },
      { lat: maxLat + latPadding, lng: maxLng + lngPadding },
      { lat: minLat - latPadding, lng: maxLng + lngPadding },
    ],
  };
}

function buildWaypoints(coordinates: Array<Coordinate & { breakBefore?: boolean }>): Waypoint[] {
  return coordinates.map((coordinate, index) => ({
    id: `manual-wp-${String(index + 1).padStart(3, "0")}`,
    sequence: index + 1,
    minute: coordinates.length > 1 ? round((index / (coordinates.length - 1)) * 75, 2) : 0,
    speedKmh: 2.8,
    lat: coordinate.lat,
    lng: coordinate.lng,
    breakBefore: coordinate.breakBefore || undefined,
  }));
}

function splitRouteAtBreaks(waypoints: Waypoint[]): Waypoint[][] {
  return waypoints.reduce<Waypoint[][]>((segments, waypoint) => {
    if (segments.length === 0 || waypoint.breakBefore) segments.push([]);
    segments[segments.length - 1].push(waypoint);
    return segments;
  }, []).filter((segment) => segment.length >= 2);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function readSavedPaths(): SavedPathRecord[] {
  try {
    const raw = window.localStorage.getItem(savedPathsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPathRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((path) => path.id && path.name && Array.isArray(path.waypoints));
  } catch {
    return [];
  }
}

function readSavedScenarios(): SavedScenarioRecord[] {
  try {
    const raw = window.localStorage.getItem(savedScenariosStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeScenarioRecord);
  } catch {
    return [];
  }
}

function readDeploymentAreas(): DeploymentArea[] {
  try {
    const raw = window.localStorage.getItem(forestAreasStorageKey);
    if (!raw) return structuredClone(seedDeploymentAreas);
    const parsed = JSON.parse(raw) as DeploymentArea[];
    if (!Array.isArray(parsed)) return structuredClone(seedDeploymentAreas);
    return parsed.filter((area) => area.id && area.name && Array.isArray(area.polygon)).map((area) => normalizeDeploymentArea(area));
  } catch {
    return structuredClone(seedDeploymentAreas);
  }
}

function readManagedMunicipalities(): MunicipalityRecord[] {
  return readLocalCollection(municipalitiesStorageKey, seedMunicipalities);
}

function readManagedStakeholders(): StakeholderRecord[] {
  return readLocalCollection(stakeholdersStorageKey, seedStakeholders);
}

function readPlannedMissions(): PlannedMissionRecord[] {
  return readLocalCollection(plannedMissionsStorageKey, seedPlannedMissions);
}

function readLocalCollection<T>(key: string, fallback: T[]): T[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return Array.isArray(value) && value.length ? value as T[] : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function readMunicipalityOrder(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(municipalityOrderStorageKey) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function persistManagementFallback(municipalityRecords: MunicipalityRecord[], areas: DeploymentArea[], stakeholders: StakeholderRecord[], missions: PlannedMissionRecord[]) {
  window.localStorage.setItem(municipalitiesStorageKey, JSON.stringify(municipalityRecords));
  window.localStorage.setItem(forestAreasStorageKey, JSON.stringify(areas));
  window.localStorage.setItem(stakeholdersStorageKey, JSON.stringify(stakeholders));
  window.localStorage.setItem(plannedMissionsStorageKey, JSON.stringify(missions));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

function readCustomIndexes(): CustomIndexDefinition[] {
  try {
    const raw = window.localStorage.getItem(customIndexesStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomIndexDefinition[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((definition) => definition.indexCode && definition.name && Array.isArray(definition.inputs));
  } catch {
    return [];
  }
}

function readIndexDisplaySettings(): IndexDisplaySetting[] {
  try {
    const raw = window.localStorage.getItem(indexDisplaySettingsStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IndexDisplaySetting[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((setting) => typeof setting.indexCode === "string");
  } catch {
    return [];
  }
}

function getIndexDisplaySetting(settings: IndexDisplaySetting[], indexCode: string): IndexDisplaySetting {
  return (
    settings.find((setting) => setting.indexCode === indexCode) ?? {
      indexCode,
      visible: true,
      favorite: false,
      channel: "Admin",
      displayMode: "Kachel",
    }
  );
}

function normalizeScenarioRecord(value: unknown): SavedScenarioRecord {
  const record = value as Partial<SavedScenarioRecord>;
  if (!record || typeof record !== "object") throw new Error("Invalid scenario");
  if (typeof record.name !== "string" || typeof record.seed !== "string") throw new Error("Invalid scenario identity");
  if (!isScenarioParams(record.params)) throw new Error("Invalid scenario params");
  if (typeof record.pathName !== "string" || !Array.isArray(record.waypoints)) throw new Error("Invalid scenario path");

  return {
    id: typeof record.id === "string" ? record.id : `scenario-${Date.now()}`,
    name: record.name,
    savedAt: typeof record.savedAt === "string" ? record.savedAt : new Date().toISOString(),
    seed: record.seed,
    params: normalizeScenarioParams(record.params),
    pathName: record.pathName,
    waypoints: buildWaypoints(record.waypoints.filter(isCoordinate)),
  };
}

function normalizeScenarioParams(value: unknown): ScenarioParams {
  if (!isScenarioParams(value)) throw new Error("Invalid scenario params");
  const params = value as ScenarioParams & { stormDamage?: number };
  const rawForestType = String((value as { forestType: unknown }).forestType);
  const rawSeason = String((value as { season: unknown }).season);
  return {
    ...params,
    forestType: rawForestType === "Aufforstungsflaeche" ? "Aufforstungsfläche" : params.forestType,
    season: rawSeason === "Fruehjahr" ? "Frühjahr" : params.season,
    stormDamage: typeof params.stormDamage === "number" ? params.stormDamage : defaultScenarioParams.stormDamage,
  } as ScenarioParams;
}

function isScenarioParams(value: unknown): value is ScenarioParams | (Omit<ScenarioParams, "stormDamage"> & { stormDamage?: number; forestType: ScenarioParams["forestType"] | "Aufforstungsflaeche"; season: ScenarioParams["season"] | "Fruehjahr" }) {
  const params = value as ScenarioParams;
  return (
    typeof params === "object" &&
    params !== null &&
    ["Mischwald", "Nadelwald", "Laubwald", "Aufforstungsfläche", "Aufforstungsflaeche"].includes(params.forestType) &&
    ["Sommer", "Frühjahr", "Fruehjahr", "Herbst", "Winter"].includes(params.season) &&
    typeof params.drought === "number" &&
    typeof params.pollution === "number" &&
    typeof params.pestPressure === "number" &&
    (typeof params.stormDamage === "number" || typeof params.stormDamage === "undefined")
  );
}

function isCoordinate(value: unknown): value is Coordinate {
  const coordinate = value as Coordinate;
  return typeof coordinate === "object" && coordinate !== null && Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng);
}

function downloadJson(value: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "athene-szenario";
}

function missionPeriodKey(timestamp: string, mode: "month" | "quarter"): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  return mode === "month"
    ? `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function formatMissionPeriod(period: string): string {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return `${quarter[2]}. Quartal ${quarter[1]}`;
  const month = period.match(/^(\d{4})-(\d{2})$/);
  if (!month) return period;
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(new Date(Number(month[1]), Number(month[2]) - 1, 1));
}

function dryStressSummaryColor(value: number): string {
  if (value >= 0.68) return "#dc2626";
  if (value >= 0.5) return "#f97316";
  if (value >= 0.32) return "#eab308";
  return "#22c55e";
}
