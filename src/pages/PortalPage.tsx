import { useState, type FormEvent, type ReactNode } from "react";
import { BarChart3, Building2, ClipboardList, FolderOpen, GripVertical, Layers, MapPinned, Play, Plus, Satellite, Save, Sprout, Users, Wrench } from "lucide-react";
import type { Coordinate, DeploymentArea, MissionPath, MunicipalityRecord, PlannedMissionRecord, ScenarioParams, StakeholderRecord } from "../domain";
import { hasDefinedMissionPath } from "../management";
import { describeWeatherCode, type LiveWeather } from "../weather";
import { plantCatalog, speciesCatalog, speciesQualityRules, type BiodiversityMetrics, type IndexDefinitionDemo } from "../speciesKnowledge";
import type { PortalRole } from "../hooks/usePortalAuthorization";

interface Municipality extends MunicipalityRecord { stakeholders: StakeholderRecord[]; areas: DeploymentArea[]; missionIds: string[] }
interface CustomerMissionTemplate { id: string; municipalityId: string; areaId: string; areaName: string; customer: string; title: string; requestedAt: string; priority: "normal" | "hoch" | "kritisch"; objective: string; seed: string; scenarioName: string; pathName: string; missionPath?: MissionPath | null; dataMode?: "real" | "mock"; routeSummary?: PlannedMissionRecord["routeSummary"]; params: ScenarioParams }
type ManagementFormData =
  | { kind: "municipality"; name: string; type: MunicipalityRecord["type"]; region: string; population: number; center: Coordinate }
  | { kind: "stakeholder"; name: string; role: string; access: StakeholderRecord["access"] }
  | { kind: "area"; name: string; focus: string; description: string; status: DeploymentArea["status"] }
  | { kind: "mission"; areaId: string; title: string; objective: string; priority: PlannedMissionRecord["priority"]; requestedAt: string };

export function PortalPage({
  role,
  onRoleChange,
  municipalities,
  areas,
  missions,
  selectedMunicipalityId,
  liveWeather,
  weatherStatus,
  biodiversityMetrics,
  indexDefinitions,
  onSelectMunicipality,
  onReorderMunicipalities,
  onOpenMunicipalityMap,
  onOpenMission,
  onOpenAreaMap,
  onCreateMunicipality,
  onEditMunicipality,
  onArchiveMunicipality,
  onCreateStakeholder,
  onEditStakeholder,
  onArchiveStakeholder,
  onCreateArea,
  onEditArea,
  onArchiveArea,
  onPlanMission,
  managementDialog,
  editingArea,
  editingMunicipality,
  editingStakeholder,
  onCloseDialog,
  onSubmitDialog,
  feedback,
  pendingSyncCount,
  onOpenIndexBuilder,
  onOpenHyperion,
  onOpenAdminMap,
  onOpenRegionalOverview,
}: {
  role: PortalRole;
  onRoleChange: (role: PortalRole) => void;
  municipalities: Municipality[];
  areas: DeploymentArea[];
  missions: CustomerMissionTemplate[];
  selectedMunicipalityId: string;
  liveWeather: LiveWeather;
  weatherStatus: "loading" | "live" | "fallback";
  biodiversityMetrics: BiodiversityMetrics;
  indexDefinitions: IndexDefinitionDemo[];
  onSelectMunicipality: (municipalityId: string) => void;
  onReorderMunicipalities: (draggedId: string, targetId: string) => void;
  onOpenMunicipalityMap: (municipalityId: string) => void;
  onOpenMission: (mission: CustomerMissionTemplate, startProcessing: boolean) => void;
  onOpenAreaMap: (areaId: string) => void;
  onCreateMunicipality: () => void;
  onEditMunicipality: (municipalityId: string) => void;
  onArchiveMunicipality: (municipalityId: string) => Promise<void>;
  onCreateStakeholder: () => void;
  onEditStakeholder: (stakeholderId: string) => void;
  onArchiveStakeholder: (stakeholderId: string) => Promise<void>;
  onCreateArea: () => void;
  onEditArea: (areaId: string) => void;
  onArchiveArea: (areaId: string) => Promise<void>;
  onPlanMission: () => void;
  managementDialog: "municipality" | "stakeholder" | "area" | "mission" | null;
  editingArea: DeploymentArea | null;
  editingMunicipality: MunicipalityRecord | null;
  editingStakeholder: StakeholderRecord | null;
  onCloseDialog: () => void;
  onSubmitDialog: (values: ManagementFormData) => Promise<void>;
  feedback: { tone: "success" | "error" | "loading"; message: string } | null;
  pendingSyncCount: number;
  onOpenIndexBuilder: () => void;
  onOpenHyperion: () => void;
  onOpenAdminMap: () => void;
  onOpenRegionalOverview: () => void;
}) {
  const selectedMunicipality = municipalities.find((item) => item.id === selectedMunicipalityId) ?? municipalities[0];
  const canManage = role === "admin";
  const [draggedMunicipalityId, setDraggedMunicipalityId] = useState<string | null>(null);
  const municipalityMissions = missions.filter((mission) => selectedMunicipality.missionIds.includes(mission.id));
  const activeAreas = selectedMunicipality.areas.filter((area) => area.status === "aktiv").length;

  return (
    <div className="portalShell">
      <header className="portalTopbar">
        <div className="portalBrand">
          <div className="brandMark">
            <Satellite size={20} />
          </div>
          <div>
            <p className="eyebrow">Project Athene</p>
            <h1>Kommunale Einsatzplattform</h1>
          </div>
        </div>
        <div className="portalLogin">
          <Users size={16} />
          <span>Demo-Rollenkontext</span>
          <select value={role} onChange={(event) => onRoleChange(event.target.value as PortalRole)} aria-label="Portalrolle">
            <option value="admin">Admin</option>
            <option value="customer">Customer</option>
          </select>
        </div>
        <div className="portalTopActions">
          <button className="commandButton" onClick={onOpenRegionalOverview} type="button">
            <Sprout size={16} />
            Waldzustandsübersicht
          </button>
          <button className="commandButton" onClick={onOpenHyperion} type="button">
            <Layers size={16} />
            Hyperion
          </button>
          {canManage && <button className="commandButton" onClick={onOpenIndexBuilder} type="button">
            <BarChart3 size={16} />
            Index Builder
          </button>}
        </div>
      </header>

      <main className="portalMain">
        {feedback && <div className={`managementFeedback ${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.message}</div>}
        {pendingSyncCount > 0 && <div className="syncQueueStatus" role="status">{pendingSyncCount} lokale Änderung(en) warten auf Synchronisierung.</div>}
        <section className="portalHero">
          <div>
            <p className="eyebrow">Zentrale Verwaltung</p>
            <h2>Gemeinden, Einsatzgebiete und Waldmissionen anlegen.</h2>
            <p>
              Diese Portalebene ist der Einstieg vor der GeoID-Maske. Hier werden kommunale Mandanten, Rollen, Flächen und Missionen verwaltet; die Detailanalyse öffnet anschließend die Karten- und Playback-Ansicht.
            </p>
          </div>
          <div className="portalAuthCard">
            <span>Demo-Kontext (keine Authentifizierung)</span>
            <strong>athene.operator@demo.local</strong>
            <small>Verwaltungsrolle: Gemeinden, Missionen, Records</small>
          </div>
          <div className={`weatherCard ${liveWeather.fireWeatherHint}`}>
            <span>{weatherStatus === "live" ? "Live Wetter" : weatherStatus === "loading" ? "Wetter lädt" : "Demo Wetter"}</span>
            <strong>{liveWeather.temperature.toFixed(1)} °C · {liveWeather.humidity}% RH</strong>
            <small>
              {describeWeatherCode(liveWeather.weatherCode)} · Böen {Math.round(liveWeather.windGusts)} km/h · {liveWeather.precipitation.toFixed(1)} mm
            </small>
            <em>Brandwetter: {liveWeather.fireWeatherHint}</em>
          </div>
        </section>

        <section className="portalGrid">
          <aside className="municipalityRail">
            <PanelTitle icon={<Building2 size={18} />} title="Gemeinden" />
            <div className="municipalityList">
              {municipalities.map((municipality) => (
                <div
                  key={municipality.id}
                  className={`municipalityButtonWrap ${municipality.id === selectedMunicipality.id ? "active" : ""} ${draggedMunicipalityId === municipality.id ? "dragging" : ""}`}
                  draggable
                  onDragStart={(event) => { setDraggedMunicipalityId(municipality.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", municipality.id); }}
                  onDragEnd={() => setDraggedMunicipalityId(null)}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData("text/plain") || draggedMunicipalityId; if (draggedId) onReorderMunicipalities(draggedId, municipality.id); setDraggedMunicipalityId(null); }}
                >
                  <GripVertical className="municipalityDragHandle" size={17} aria-hidden="true" />
                  <div className="municipalityButton">
                    <button className="municipalitySelectButton" onClick={() => onSelectMunicipality(municipality.id)} type="button">
                      <span>{municipality.type}</span><small>{municipality.region}</small>
                    </button>
                    <button className="municipalityMapLink" onClick={() => onOpenMunicipalityMap(municipality.id)} type="button" aria-label={`${municipality.name} in der Kartenansicht öffnen`}>
                      {municipality.name}<MapPinned size={13} />
                    </button>
                  </div>
                  {canManage && <div className="entityActions">
                    <button className="iconButton" onClick={() => onEditMunicipality(municipality.id)} aria-label={`${municipality.name} bearbeiten`} type="button"><Wrench size={13} /></button>
                    <button className="iconButton danger" onClick={() => void onArchiveMunicipality(municipality.id)} aria-label={`${municipality.name} archivieren`} type="button"><FolderOpen size={13} /></button>
                  </div>}
                </div>
              ))}
            </div>
            <button className="portalMapButton" onClick={onOpenAdminMap} type="button">
              <MapPinned size={16} />
              Kartenansicht
            </button>
            {canManage && <button className="portalAddButton" onClick={onCreateMunicipality} type="button">
              <Plus size={16} />
              Gemeinde anlegen
            </button>}
          </aside>

          <section className="portalDetail">
            <div className="portalSectionHeader">
              <div>
                <p className="eyebrow">{selectedMunicipality.type}</p>
                <h2>{selectedMunicipality.name}</h2>
                <span>{selectedMunicipality.region}</span>
              </div>
              {canManage && <button className="commandButton primary" onClick={onCreateArea} type="button">
                <Plus size={16} />
                Einsatzgebiet
              </button>}
            </div>

            <div className="portalStats">
              <OverviewMetric label="Einwohner" value={selectedMunicipality.population.toLocaleString("de-DE")} detail="Mandantendaten" />
              <OverviewMetric label="Stakeholder" value={`${selectedMunicipality.stakeholders.length}`} detail="Rollen im Portal" />
              <OverviewMetric label="Einsatzgebiete" value={`${selectedMunicipality.areas.length}`} detail={`${activeAreas} aktiv`} />
              <OverviewMetric label="Missionen" value={`${municipalityMissions.length}`} detail="bereit für GeoID" />
              <OverviewMetric label="Wetterquelle" value={liveWeather.source === "open-meteo" ? "Live" : "Fallback"} detail={new Date(liveWeather.fetchedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} />
            </div>

            <div className="portalStats knowledgeStats">
              <OverviewMetric label="Taxa" value={`${speciesCatalog.length}`} detail={`${plantCatalog.length} Pflanzen · ${speciesCatalog.length - plantCatalog.length} Vögel`} />
              <OverviewMetric label="Mission Richness" value={`${biodiversityMetrics.richness}`} detail={`${biodiversityMetrics.validObservationCount} gültige Beobachtungen`} />
              <OverviewMetric label="Shannon" value={biodiversityMetrics.shannon.toFixed(2)} detail={`Simpson ${biodiversityMetrics.simpson.toFixed(2)}`} />
              <OverviewMetric label="Audioaktivität" value={`${biodiversityMetrics.acousticActivityRate}`} detail="Events je Audio-Stunde" />
              <OverviewMetric label="Index Builder" value={`${indexDefinitions.length}`} detail="versionierte Indizes" />
            </div>

            <div className="portalColumns">
              <section className="portalPanel">
                <div className="panelTitleActions"><PanelTitle icon={<Users size={18} />} title="Stakeholder" />{canManage && <button className="iconButton" onClick={onCreateStakeholder} aria-label="Stakeholder hinzufügen" type="button"><Plus size={16} /></button>}</div>
                <div className="stakeholderList">
                  {selectedMunicipality.stakeholders.map((stakeholder) => (
                    <div key={stakeholder.id} className="stakeholderRow">
                      <div>
                        <strong>{stakeholder.name}</strong>
                        <span>{stakeholder.role}</span>
                      </div>
                      <small>{stakeholder.access}</small>
                      {canManage && <div className="entityActions">
                        <button className="iconButton" onClick={() => onEditStakeholder(stakeholder.id)} aria-label={`${stakeholder.name} bearbeiten`} type="button"><Wrench size={13} /></button>
                        <button className="iconButton danger" onClick={() => void onArchiveStakeholder(stakeholder.id)} aria-label={`${stakeholder.name} archivieren`} type="button"><FolderOpen size={13} /></button>
                      </div>}
                    </div>
                  ))}
                </div>
              </section>

              <section className="portalPanel">
                <PanelTitle icon={<MapPinned size={18} />} title="Einsatzgebiete" />
                <div className="areaList">
                  {selectedMunicipality.areas.map((area) => (
                    <div key={area.id} className={`areaRow ${area.status}`}>
                      <button className="areaRowMain" onClick={() => onOpenAreaMap(area.id)} type="button" title="Einsatzgebiet auf der Karte fokussieren">
                        <strong>{area.name}</strong>
                        <span>{area.focus}</span>
                      </button>
                      <small>{area.boundaryStatus === "pending" ? "Grenze ausstehend" : `${area.hectares} ha`} · {area.status}</small>
                      <div className="areaRowActions">
                        <button className={area.boundaryStatus === "pending" ? "commandButton boundaryAction" : "iconButton"} onClick={() => onOpenAreaMap(area.id)} title={area.boundaryStatus === "pending" ? "Grenze auf Karte einzeichnen" : "Auf Karte öffnen"} aria-label={`${area.name} ${area.boundaryStatus === "pending" ? "Grenze auf Karte einzeichnen" : "auf Karte öffnen"}`} type="button"><MapPinned size={14} />{area.boundaryStatus === "pending" && "Grenze auf Karte einzeichnen"}</button>
                        {canManage && <button className="iconButton" onClick={() => onEditArea(area.id)} title="Bearbeiten" aria-label={`${area.name} bearbeiten`} type="button"><Wrench size={14} /></button>}
                        {canManage && <button className="iconButton danger" onClick={() => void onArchiveArea(area.id)} title="Archivieren" aria-label={`${area.name} archivieren`} type="button"><FolderOpen size={14} /></button>}
                      </div>
                    </div>
                  ))}
                  {selectedMunicipality.areas.length === 0 && <p className="emptyRecordHistory">Noch keine Einsatzgebiete angelegt.</p>}
                </div>
              </section>
            </div>

            <section className="portalPanel">
              <div className="panelTitleActions"><PanelTitle icon={<ClipboardList size={18} />} title="Missionen" />{canManage && <button className="commandButton" onClick={onPlanMission} type="button"><Plus size={15} />Mission planen</button>}</div>
              <div className="portalMissionList">
                {municipalityMissions.map((missionTemplate) => (
                  <div key={missionTemplate.id} className={`portalMissionRow ${missionTemplate.priority}`}>
                    <div>
                      <span>{missionTemplate.areaName} · {missionTemplate.priority}</span>
                      <strong>{missionTemplate.title}</strong>
                      <p>{missionTemplate.objective}</p>
                    </div>
                    <button className="commandButton" onClick={() => onOpenMission(missionTemplate, false)} type="button">
                      <MapPinned size={16} />
                      GeoID öffnen
                    </button>
                    <button className="commandButton primary" onClick={() => onOpenMission(missionTemplate, true)} disabled={!hasDefinedMissionPath(missionTemplate)} title={!hasDefinedMissionPath(missionTemplate) ? "Noch kein Missionspfad definiert" : undefined} type="button">
                      <Play size={16} />
                      Daten verarbeiten
                    </button>
                    {!hasDefinedMissionPath(missionTemplate) && <small className="missionPathMissing">Noch kein Missionspfad definiert</small>}
                  </div>
                ))}
              </div>
            </section>

            <section className="portalPanel">
              <PanelTitle icon={<Sprout size={18} />} title="Artenwissensbasis & Index Builder" />
              <div className="knowledgeGrid">
                <div>
                  <span>Starterkatalog</span>
                  <strong>{speciesCatalog.length} Taxa mit Quelle, Habitat, Detektion und Mindestconfidence</strong>
                  <small>{speciesQualityRules[1]}</small>
                </div>
                <div>
                  <span>Freigaberegel</span>
                  <strong>{indexDefinitions[0]?.status ?? "EXPERIMENTAL"}</strong>
                  <small>{speciesQualityRules[6]}</small>
                </div>
                <div>
                  <span>Index Preview</span>
                  <strong>{indexDefinitions[0]?.name ?? "Neuer Index"}</strong>
                  <small>{indexDefinitions[0]?.interpretationLimit ?? "Noch keine Definition gespeichert"}</small>
                </div>
              </div>
              {canManage && <button className="indexBuilderOpenButton" onClick={onOpenIndexBuilder} type="button">
                <BarChart3 size={16} />
                Index Builder öffnen
              </button>}
            </section>
          </section>
        </section>
      </main>
      {managementDialog && (
        <ManagementDialog
          kind={managementDialog}
          municipality={selectedMunicipality}
          areas={areas.filter((area) => area.municipalityId === selectedMunicipality.id && area.status !== "archiviert")}
          editingArea={editingArea}
          editingMunicipality={editingMunicipality}
          editingStakeholder={editingStakeholder}
          onClose={onCloseDialog}
          onSubmit={onSubmitDialog}
        />
      )}
    </div>
  );
}

function ManagementDialog({
  kind,
  municipality,
  areas,
  editingArea,
  editingMunicipality,
  editingStakeholder,
  onClose,
  onSubmit,
}: {
  kind: "municipality" | "stakeholder" | "area" | "mission";
  municipality: Municipality;
  areas: DeploymentArea[];
  editingArea: DeploymentArea | null;
  editingMunicipality: MunicipalityRecord | null;
  editingStakeholder: StakeholderRecord | null;
  onClose: () => void;
  onSubmit: (values: ManagementFormData) => Promise<void>;
}) {
  const [name, setName] = useState(editingArea?.name ?? editingMunicipality?.name ?? editingStakeholder?.name ?? "");
  const [secondary, setSecondary] = useState(editingArea?.focus ?? editingMunicipality?.region ?? editingStakeholder?.role ?? "");
  const [description, setDescription] = useState(editingArea?.description ?? "");
  const [choice, setChoice] = useState(() => kind === "municipality" ? editingMunicipality?.type ?? "Gemeinde" : kind === "stakeholder" ? editingStakeholder?.access ?? "Viewer" : kind === "area" ? editingArea?.status ?? "aktiv" : areas[0]?.id ?? "");
  const [extra, setExtra] = useState(() => kind === "municipality" ? String(editingMunicipality?.population ?? "") : kind === "mission" ? "normal" : "");

  const title = kind === "municipality" ? editingMunicipality ? "Gemeinde bearbeiten" : "Gemeinde anlegen" : kind === "stakeholder" ? editingStakeholder ? "Stakeholder bearbeiten" : "Stakeholder hinzufügen" : kind === "area" ? editingArea ? "Einsatzgebiet bearbeiten" : "Einsatzgebiet anlegen" : "Mission planen";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (kind === "municipality") {
      void onSubmit({ kind, name: name.trim(), type: (choice as MunicipalityRecord["type"]) || "Gemeinde", region: secondary.trim() || "Baden-Württemberg", population: Number(extra) || 0, center: municipality.center });
    } else if (kind === "stakeholder") {
      void onSubmit({ kind, name: name.trim(), role: secondary.trim() || "Fachliche Beteiligung", access: (choice as StakeholderRecord["access"]) || "Viewer" });
    } else if (kind === "area") {
      void onSubmit({ kind, name: name.trim(), focus: secondary.trim() || "Allgemeines Waldmonitoring", description, status: choice as DeploymentArea["status"] });
    } else {
      void onSubmit({ kind, areaId: choice, title: name.trim(), objective: secondary.trim(), priority: (extra as PlannedMissionRecord["priority"]) || "normal", requestedAt: new Date().toISOString() });
    }
  };

  return (
    <div className="dialogBackdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="managementDialog" role="dialog" aria-modal="true" aria-labelledby="management-dialog-title">
        <form onSubmit={submit}>
          <div className="portalSectionHeader">
            <div><p className="eyebrow">Verwaltung</p><h2 id="management-dialog-title">{title}</h2></div>
            <button className="iconButton" type="button" onClick={onClose} aria-label="Dialog schließen">×</button>
          </div>
          <label className="fieldLabel">{kind === "mission" ? "Missionstitel" : "Name"}<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="fieldLabel">{kind === "municipality" ? "Region" : kind === "stakeholder" ? "Rolle" : kind === "mission" ? "Ziel" : "Fokus"}<input value={secondary} onChange={(event) => setSecondary(event.target.value)} /></label>
          {kind === "municipality" && <><label className="fieldLabel">Typ<select value={choice || "Gemeinde"} onChange={(event) => setChoice(event.target.value)}><option>Gemeinde</option><option>Stadt</option><option>Landkreis</option></select></label><label className="fieldLabel">Einwohner<input inputMode="numeric" value={extra} onChange={(event) => setExtra(event.target.value)} /></label></>}
          {kind === "stakeholder" && <label className="fieldLabel">Zugriff (Verwaltungsangabe, keine Authentifizierung)<select value={choice || "Viewer"} onChange={(event) => setChoice(event.target.value)}><option>Admin</option><option>Operator</option><option>Viewer</option></select></label>}
          {kind === "area" && <><label className="fieldLabel">Beschreibung<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="fieldLabel">Status<select value={choice} onChange={(event) => setChoice(event.target.value)}><option value="aktiv">Aktiv</option><option value="planung">Planung</option><option value="review">Review</option></select></label>{!editingArea && <p className="dialogHint">Es wird zunächst eine kleine Fläche am Gemeindezentrum angelegt. Die exakte Grenze kann anschließend in der Kartenansicht neu gezeichnet werden.</p>}</>}
          {kind === "mission" && <><label className="fieldLabel">Einsatzgebiet<select required value={choice} onChange={(event) => setChoice(event.target.value)}>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label className="fieldLabel">Priorität<select value={extra || "normal"} onChange={(event) => setExtra(event.target.value)}><option value="normal">Normal</option><option value="hoch">Hoch</option><option value="kritisch">Kritisch</option></select></label></>}
          <div className="dialogActions"><button className="commandButton" type="button" onClick={onClose}>Abbrechen</button><button className="commandButton primary" type="submit" disabled={kind === "mission" && areas.length === 0}><Save size={16} />Speichern</button></div>
        </form>
      </section>
    </div>
  );
}


function OverviewMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="overviewMetric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="panelTitle">{icon}<h2>{title}</h2></div>;
}
