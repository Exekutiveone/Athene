import { useState } from "react";
import { ArrowLeft, FileText, MapPinned, Save, ShieldCheck, Upload } from "lucide-react";
import type { Coordinate, DeploymentArea, PlannedMissionRecord } from "../domain";

interface Props {
  area: DeploymentArea;
  route: Coordinate[];
  onBack: () => void;
  onCreateMission: (values: { title: string; objective: string; priority: PlannedMissionRecord["priority"] }) => Promise<void>;
}

export function RealMissionUploadPage({ area, route, onBack, onCreateMission }: Props) {
  const [title, setTitle] = useState(`${area.name} Feldmission`);
  const [objective, setObjective] = useState("Reale Befahrung und anschließender Messdaten-Upload");
  const [priority, setPriority] = useState<PlannedMissionRecord["priority"]>("normal");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (route.length < 2) {
      setStatus("Für die reale Mission fehlt eine Route. Bitte im Waldgebiet zuerst einen vorhandenen Weg übernehmen oder eine Route einzeichnen.");
      return;
    }
    if (!title.trim() || !objective.trim()) {
      setStatus("Bitte Titel und Missionsziel ausfüllen.");
      return;
    }
    if (files.length === 0) {
      setStatus("Bitte mindestens eine Mess- oder Mediendatei auswählen.");
      return;
    }
    setSaving(true);
    setStatus("Mission und Upload-Metadaten werden gespeichert …");
    try {
      await onCreateMission({ title, objective, priority });
      setStatus("Reale Mission wurde angelegt. Die ausgewählten Dateien sind als Upload-Prototyp real / ungeprüft vorgemerkt.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Mission konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="realMissionUploadShell">
      <header className="forestDetailHeader">
        <button className="commandButton" onClick={onBack} type="button"><ArrowLeft size={16} />Zum Waldgebiet</button>
        <div><p className="eyebrow">Reale Mission · Upload-Prototyp</p><h1>{area.name}</h1><small>Datenupload und Missionsanlage</small></div>
      </header>
      <main className="realMissionUploadMain">
        <section className="uploadMissionIntro">
          <ShieldCheck size={24} />
          <div><strong>Reale Daten bleiben bis zur fachlichen Prüfung ungeprüft.</strong><p>Dateien werden in dieser Mock-Maske ausgewählt und der Mission zugeordnet. Sie werden nicht als validierte Messwerte oder flächendeckende Erkenntnisse dargestellt.</p></div>
        </section>
        <form className="realMissionUploadForm" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className="uploadMissionFields">
            <label className="fieldLabel">Missionstitel<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="fieldLabel">Missionsziel<textarea value={objective} onChange={(event) => setObjective(event.target.value)} /></label>
            <label className="fieldLabel">Priorität<select value={priority} onChange={(event) => setPriority(event.target.value as PlannedMissionRecord["priority"])}><option value="normal">Normal</option><option value="hoch">Hoch</option><option value="kritisch">Kritisch</option></select></label>
            <div className="uploadRouteStatus"><MapPinned size={17} /><span><strong>{route.length} Routenpunkte</strong><small>{route.length >= 2 ? "Route aus Waldansicht übernommen" : "Keine verwendbare Route vorhanden"}</small></span></div>
          </div>
          <label className="realUploadDropzone">
            <Upload size={28} /><strong>Messdaten oder Medien auswählen</strong><small>CSV, JSON, GeoJSON, Bilder und ZIP · Mock-Upload ohne fachliche Validierung</small>
            <input type="file" multiple accept=".csv,.json,.geojson,.zip,image/*" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          </label>
          {files.length > 0 && <div className="realUploadFileList">{files.map((file) => <div key={`${file.name}-${file.size}`}><FileText size={15} /><span><strong>{file.name}</strong><small>{(file.size / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} KB · real / ungeprüft</small></span></div>)}</div>}
          <button className="commandButton primary" disabled={saving || route.length < 2 || files.length === 0} type="submit"><Save size={16} />Reale Mission anlegen</button>
          {status && <p className="missionPlannerFeedback" role="status">{status}</p>}
        </form>
      </main>
    </div>
  );
}
