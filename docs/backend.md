# Athene Backend

Das lokale Backend ist ein Express/TypeScript-Service. Es ersetzt den bisherigen reinen Browser-Speicher fuer Szenarien, Wege und Mission Records.

## Start

```bash
npm run dev
```

Oder getrennt:

```bash
npm run dev:api
npm run dev:web
```

## Persistenz

Die Entwicklungsdatenbank ist eine JSON-Datei:

```text
.data/athene-db.json
```

Sie enthaelt:

- `savedPaths`
- `savedScenarios`
- `missionRecords`

Die Datei ist bewusst in `.gitignore`, weil sie lokale Arbeitsdaten enthaelt.

## API

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/health` | Status und Objektzaehler |
| `GET` | `/api/paths` | gespeicherte Wege lesen |
| `PUT` | `/api/paths/:id` | Weg speichern/ersetzen |
| `DELETE` | `/api/paths/:id` | Weg loeschen |
| `GET` | `/api/scenarios` | gespeicherte Szenarien lesen |
| `PUT` | `/api/scenarios/:id` | Szenario speichern/ersetzen |
| `DELETE` | `/api/scenarios/:id` | Szenario loeschen |
| `GET` | `/api/mission-records` | generierte Mission Records lesen |
| `PUT` | `/api/mission-records/:id` | Mission Record speichern/ersetzen |
| `DELETE` | `/api/mission-records/:id` | Mission Record loeschen |
| `GET` | `/api/copernicus/status` | Backend-Konfigurationsstatus fuer Copernicus |

## Naechster Ausbauschritt

Der naechste technische Schritt ist ein echter Copernicus-Proxy im Backend:

- OAuth-/Client-Credentials nur serverseitig halten.
- STAC/Catalog-Suche ueber das Backend.
- Sentinel-Hub Process API ueber das Backend.
- Ergebnisse als `missionRecords` oder spaeter in PostGIS persistieren.
