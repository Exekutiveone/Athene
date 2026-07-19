import { Fragment, useState, type ReactNode } from "react";
import { ArrowLeft, ClipboardList, MapPinned, Sprout } from "lucide-react";
import { MapContainer, Polygon, TileLayer, Tooltip } from "react-leaflet";
import type { Coordinate, DeploymentArea, MissionPath, MissionRecord, MunicipalityRecord, PlannedMissionRecord, ScenarioParams, StakeholderRecord } from "../domain";
import { aggregateAreaRecords } from "../management";
import { colorForValue, getLayerDefinition } from "../generator";
import { FitCoordinateBounds } from "../components/MapControllers";

interface Municipality extends MunicipalityRecord { stakeholders: StakeholderRecord[]; areas: DeploymentArea[]; missionIds: string[] }
interface CustomerMissionTemplate { id: string; municipalityId: string; areaId: string; areaName: string; customer: string; title: string; requestedAt: string; priority: "normal" | "hoch" | "kritisch"; objective: string; seed: string; scenarioName: string; pathName: string; missionPath?: MissionPath | null; dataMode?: "real" | "mock"; routeSummary?: PlannedMissionRecord["routeSummary"]; params: ScenarioParams }
const baseMaps = { street: { attribution: '&copy; OpenStreetMap contributors', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' } } as const;
const toLatLng = (point: Coordinate): [number, number] => [point.lat, point.lng];
const centroidOf = (points: Coordinate[]): Coordinate => ({ lat: points.reduce((sum, p) => sum + p.lat, 0) / Math.max(1, points.length), lng: points.reduce((sum, p) => sum + p.lng, 0) / Math.max(1, points.length) });

export function AreaContextPage({ municipality, area, missions, records, onBackToPortal, onOpenMission, onOpenMap }: {
  municipality: Municipality;
  area: DeploymentArea;
  missions: CustomerMissionTemplate[];
  records: MissionRecord[];
  onBackToPortal: () => void;
  onOpenMission: (mission: CustomerMissionTemplate) => void;
  onOpenMap: () => void;
}) {
  const aggregate = aggregateAreaRecords(area.id, records);
  return (
    <div className="portalShell areaContextShell">
      <header className="portalTopbar"><div className="portalBrand"><div className="brandMark"><MapPinned size={20} /></div><div><p className="eyebrow">GeoID · Gebietsansicht</p><h1>{area.name}</h1></div></div><div className="portalTopActions"><button className="commandButton" onClick={onBackToPortal} type="button"><ArrowLeft size={16} />Portal</button><button className="commandButton" onClick={onOpenMap} type="button"><MapPinned size={16} />Auf Karte öffnen</button></div></header>
      <main className="areaContextMain">
        <section className="contextBreadcrumb" aria-label="Analysekontext">{municipality.name} <span>→</span> {area.name} <span>→</span> Alle Missionen</section>
        <div className="contextModeSwitch"><button className="active" type="button">Gebietsansicht</button>{missions[0] && <button type="button" onClick={() => onOpenMission(missions[0])}>Missionsansicht</button>}</div>
        <section className="areaContextGrid">
          <div className="regionalMapCard"><MapContainer center={toLatLng(centroidOf(area.polygon))} zoom={14} className="regionalMap"><TileLayer attribution={baseMaps.street.attribution} url={baseMaps.street.url} /><FitCoordinateBounds polygon={area.polygon} /><Polygon positions={area.polygon.map(toLatLng)} pathOptions={{ color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 0.28, weight: 3 }}><Tooltip permanent>{area.name} · {area.hectares.toLocaleString("de-DE")} ha</Tooltip></Polygon></MapContainer></div>
          <aside className="areaAggregatePanel"><p className="eyebrow">Gebietsüberblick</p><h2>{aggregate.missionCount ? "Zusammengefasster Missionsstand" : "Keine Daten"}</h2><div className="statusGrid"><StatusPill label="Missionen" value={`${aggregate.missionCount}`} /><StatusPill label="Letzte Erhebung" value={aggregate.lastSurvey ? new Date(aggregate.lastSurvey).toLocaleDateString("de-DE") : "Keine Daten"} /><StatusPill label="Trockenstress" value={aggregate.dryStress === null ? "Keine Daten" : `${Math.round(aggregate.dryStress * 100)}%`} /><StatusPill label="Confidence" value={aggregate.confidence === null ? "Keine Daten" : `${Math.round(aggregate.confidence * 100)}%`} /><StatusPill label="Abdeckung" value={aggregate.coverageShare === null ? "Keine Daten" : `${Math.round(aggregate.coverageShare * 100)}%`} /><StatusPill label="Unbekannt" value={aggregate.unknownShare === null ? "Keine Daten" : `${Math.round(aggregate.unknownShare * 100)}%`} /></div><p className="provenanceNote">Datenherkunft: {aggregate.dataOrigin ?? "unbekannt"} · Status: {aggregate.dataStatus ?? "unbeobachtet"}. Nicht erhobene Flächen werden nicht als gesund bewertet.</p></aside>
        </section>
        <section className="portalPanel"><div className="panelTitleActions"><PanelTitle icon={<ClipboardList size={18} />} title="Missionen im Einsatzgebiet" /></div>{missions.length === 0 ? <p className="emptyRecordHistory">Für dieses Einsatzgebiet ist noch keine Mission geplant.</p> : <div className="portalMissionList">{missions.map((missionItem) => <div key={missionItem.id} className="portalMissionRow"><div><span>bereit · {missionItem.priority}</span><strong>{missionItem.title}</strong><p>{missionItem.objective}</p></div><button className="commandButton" type="button" onClick={() => onOpenMission(missionItem)}>Missionsansicht</button></div>)}</div>}</section>
      </main>
    </div>
  );
}

export function RegionalConditionOverview({ municipalities, areas, records, onBack, onOpenArea }: { municipalities: MunicipalityRecord[]; areas: DeploymentArea[]; records: MissionRecord[]; onBack: () => void; onOpenArea: (areaId: string) => void }) {
  const [metric, setMetric] = useState<"dryStress" | "confidence" | "freshness">("dryStress");
  const [municipalityId, setMunicipalityId] = useState("all");
  const [status, setStatus] = useState("all");
  const visible = areas.filter((area) => area.status !== "archiviert" && (municipalityId === "all" || area.municipalityId === municipalityId) && (status === "all" || area.status === status));
  const polygons = visible.flatMap((area) => area.polygon);
  const metricValue = (area: DeploymentArea): number | null => {
    const aggregate = aggregateAreaRecords(area.id, records);
    if (metric === "dryStress") return aggregate.dryStress;
    if (metric === "confidence") return aggregate.confidence;
    if (!aggregate.lastSurvey) return null;
    return Math.max(0, 1 - (Date.now() - new Date(aggregate.lastSurvey).getTime()) / (1000 * 60 * 60 * 24 * 365));
  };
  const fill = (value: number | null) => value === null ? "#6b7280" : metric === "dryStress" ? colorForValue(value, getLayerDefinition("dryStress")) : metric === "confidence" ? colorForValue(value, getLayerDefinition("confidence")) : value > 0.65 ? "#16a34a" : value > 0.3 ? "#f59e0b" : "#dc2626";
  const legend = metric === "dryStress" ? { low: "#10b981", lowLabel: "niedriger Stress", high: "#dc2626", highLabel: "hoher Stress" } : metric === "confidence" ? { low: "#6b7280", lowLabel: "niedrige Confidence", high: "#2563eb", highLabel: "hohe Confidence" } : { low: "#dc2626", lowLabel: "veraltet", high: "#16a34a", highLabel: "aktuell" };
  return (
    <div className="portalShell regionalOverviewShell"><header className="portalTopbar"><div className="portalBrand"><div className="brandMark"><Sprout size={20} /></div><div><p className="eyebrow">Alle Einsatzgebiete</p><h1>Waldzustandsübersicht</h1></div></div><button className="commandButton" onClick={onBack} type="button"><ArrowLeft size={16} />Portal</button></header><main className="regionalOverviewMain"><section className="regionalControls"><label>Darstellung<select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)}><option value="dryStress">Trockenstress</option><option value="confidence">Confidence</option><option value="freshness">Datenaktualität</option></select></label><label>Gemeinde<select value={municipalityId} onChange={(event) => setMunicipalityId(event.target.value)}><option value="all">Alle</option>{municipalities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Alle</option><option value="aktiv">Aktiv</option><option value="planung">Planung</option><option value="review">Review</option></select></label><div className="regionalLegend"><span><i style={{ background: "#6b7280" }} />Unbekannte Fläche</span><span><i style={{ background: legend.low }} />{legend.lowLabel}</span><span><i style={{ background: legend.high }} />{legend.highLabel}</span><span>Gestrichelt/transparent = Teilabdeckung</span></div></section><section className="regionalMapCard"><MapContainer center={[48.77, 9.3]} zoom={11} className="regionalMap"><TileLayer attribution={baseMaps.street.attribution} url={baseMaps.street.url} />{polygons.length >= 3 && <FitCoordinateBounds polygon={polygons} padding={64} />}{visible.map((area) => { const value = metricValue(area); const aggregate = aggregateAreaRecords(area.id, records); const coverageShare = aggregate.coverageShare ?? 0; const tooltip = <Tooltip><strong>{area.name}</strong><br />{value === null ? "Keine Daten" : metric === "freshness" ? `${Math.round(value * 100)}% Aktualität` : `${Math.round(value * 100)}%`}<br />Abdeckung {Math.round(coverageShare * 100)}% · unbekannt {Math.round((aggregate.unknownShare ?? 1) * 100)}%<br /><small>{value === null ? "unbeobachtet" : `${aggregate.dataOrigin}/${aggregate.dataStatus} · nur Teilabdeckung qualifiziert`}</small></Tooltip>; return <Fragment key={area.id}><Polygon positions={area.polygon.map(toLatLng)} eventHandlers={{ click: () => onOpenArea(area.id) }} pathOptions={{ color: "#4b5563", fillColor: "#6b7280", fillOpacity: 0.48, weight: 2 }}>{value === null ? tooltip : null}</Polygon>{value !== null && <Polygon positions={area.polygon.map(toLatLng)} eventHandlers={{ click: () => onOpenArea(area.id) }} pathOptions={{ color: "#ffffff", fillColor: fill(value), fillOpacity: 0.14 + coverageShare * 0.5, weight: 2, dashArray: coverageShare < 0.95 ? "7 6" : undefined }}>{tooltip}</Polygon>}</Fragment>; })}</MapContainer></section><p className="provenanceNote">Die Übersicht aggregiert ausschließlich die neueste Version je Mission. Grau bedeutet unbekannt. Farbige, transparente Flächen qualifizieren nur den abgedeckten Anteil; sie behaupten keinen flächendeckenden Messwert.</p></main></div>
  );
}


function StatusPill({ label, value }: { label: string; value: string }) { return <div className="statusPill"><span>{label}</span><strong>{value}</strong></div>; }
function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) { return <div className="panelTitle">{icon}<h2>{title}</h2></div>; }
