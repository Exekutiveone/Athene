# Athene – technische Modulgrenzen

## Grundsatz

`App.tsx` orchestriert Ansichten und UI-Zustand. Fachberechnungen, Netzwerkzugriffe, Persistenz und Geometriealgorithmen gehören in eigenständige Module und müssen ohne React-Komponente testbar bleiben.

## Aktuelle Verantwortlichkeiten

- `domain.ts`: gemeinsame Datentypen und persistierte Vertragsformen.
- `management.ts`: Verwaltungs-, Auswahl- und Aggregationslogik.
- `generator.ts`: reproduzierbare synthetische Missionen und Messwerte.
- `forestHeatmap.ts`: gemeinsamer Ergebnisvertrag für gerenderte Heatmap-Layer.
- `workers/forestHeatmap.worker.ts`: nicht blockierende IDW-Berechnung außerhalb des UI-Threads.
- `hooks/useForestHeatmap.ts`: Abbruch, begrenzter Ergebnis-Cache und Worker-Lebenszyklus.
- `osmForestPaths.ts`: OSM-Client, Browser-LRU und geometrisches Zuschneiden von Wegen.
- `api.ts`: Athene-API-Client für persistierte Datensätze.
- `server/osmProxy.ts`: validierter Overpass-Zugriff, Fallbacks und Servercache.
- Der OSM-Proxy schneidet Wege serverseitig am Waldpolygon, vereinfacht die Geometrie und liefert vorbereitete Segmente an den Browser.
- `server/store.ts`: persistente Speicherung und Migration.
- `server/validation.ts`: Validierung an der Servergrenze.
- `pages/RealMissionUploadPage.tsx`: eigenständiger Ablauf für reale Missionen und Upload-Metadaten.
- `pages/PortalPage.tsx`: kommunale Portaloberfläche einschließlich Verwaltungsdialogen.
- `hooks/usePortalAuthorization.ts`: serverbestätigter Admin-/Customer-Zustand und Sitzungsprüfung.
- `components/MapControllers.tsx`: wiederverwendbare Leaflet-Controller ohne fachliche Seitenlogik.

## Verbindliche Datenregeln

- Messwerte, Interpolationen und Simulationen behalten Herkunft, Status, Quelle, Zeitpunkt, Confidence und Modellversion.
- Interpolierte Waldflächen sind keine flächendeckenden Messungen.
- Missionswege werden ausschließlich über ihre `missionId` und `areaId` geladen.
- Missionswege verwenden kanonische `segments` entsprechend einer MultiLineString-Geometrie; getrennte Abschnitte werden nie durch Luftlinien verbunden. Legacy-`waypoints` werden beim Laden migriert.
- Leere oder fehlgeschlagene OSM-Antworten werden nicht als gültiges Wegenetz gecacht.
- Schreiboperationen der Customer-Rolle werden nicht nur visuell ausgeblendet, sondern auch in den Ereignis- und Speicherfunktionen blockiert.

## Nächste sinnvolle Zerlegung

Bei weiteren Änderungen sollten die großen Seitenkomponenten aus `App.tsx` jeweils in `src/pages/` verschoben werden. Der nächste Kandidat ist `BadenWuerttembergMapPage`, gefolgt von der GeoID-Missionsansicht. Diese Zerlegung sollte schrittweise mit unverändertem Verhalten und eigenen Komponententests erfolgen.
