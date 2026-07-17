# Project Athene

Project Athene ist die strategische Auswertungs- und Visualisierungsschicht oberhalb der Artemis-Datenplattform. Das System übersetzt Missionen, Zeitreihen, Kamera-/Audiodaten und Detektionen in georaeumliche Kartenlayer, Zeitverlaeufe, Indikatoren, Szenarien und entscheidungsrelevante Lagebilder.

Der erste Entwicklungsstand fokussiert auf reproduzierbare Mock-Daten fuer manuell angelegte Waldgebiete und Waldwege. Nutzer konfigurieren Waldtyp, Jahreszeit, Wetter, Belastung und Missionsparameter; Athene simuliert daraus eine UGV-Fahrt mit Sensordaten, Detektionsereignissen, raeumlichen Mustern und Unsicherheiten.

## Kernprinzipien

- Die Karte ist die primaere Arbeitsflaeche.
- Jeder sichtbare Wert braucht Herkunft, Zeitpunkt, Status und Confidence.
- Simulierte, gemessene, abgeleitete, interpolierte und modellierte Daten muessen klar unterscheidbar sein.
- Unbekannte Flaechen bleiben sichtbar unbekannt und erhalten keine scheinpraezisen Werte.
- Indizes und Modelle sind versioniert, damit historische Ergebnisse reproduzierbar bleiben.
- Oeffentliche Inhalte werden nur nach expliziter Freigabe sichtbar.

## Wichtige Dokumente

- [Projektkontext](docs/project-context.md)
- [Originale Project Note](docs/source/Project_Athene_Project_Note_v0.1.docx)

## MVP-Schnitt

Der MVP soll Gebiet, Wege, Szenario, simulierte Mission, Kartenlayer, Confidence, einfache Indizes, Mission Playback und einen reduzierten Buergermonitor zusammenbringen. Details stehen im Projektkontext.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

`npm run dev` startet:

- Frontend: `http://127.0.0.1:5173/`
- Backend API: `http://127.0.0.1:8787/api/health`

Persistente lokale Daten liegen in `.data/athene-db.json` und werden nicht versioniert.

## Backend API

- `GET /api/health`
- `GET /api/paths`
- `PUT /api/paths/:id`
- `DELETE /api/paths/:id`
- `GET /api/scenarios`
- `PUT /api/scenarios/:id`
- `DELETE /api/scenarios/:id`
- `GET /api/mission-records`
- `PUT /api/mission-records/:id`
- `GET /api/copernicus/status`
