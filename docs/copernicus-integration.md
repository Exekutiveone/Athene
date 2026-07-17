# Copernicus Integration

Athene ist fuer Copernicus Data Space / Sentinel Hub vorbereitet. Der aktuelle MVP nutzt einen deterministischen Demo-Fallback, damit die App ohne Zugangsdaten laeuft. Echte API-Aufrufe koennen spaeter ueber dieselben Typen und Layer angeschlossen werden.

## Aktuelle Layer

- `copernicusNdvi`: Vegetationsvitalitaet aus Sentinel-2-Kontext.
- `copernicusNdmi`: Vegetations-/Feuchtestress.
- `copernicusNbr`: Struktur-/Stoerungsindikator.

Alle Copernicus-Zellen tragen:

- `dataOrigin: "external"`
- `dataStatus: "modeled"`
- Quelle `Copernicus Data Space / Sentinel Hub demo fallback`
- Szenendatum, Cloud-Cover und Confidence im Mission Record

## Environment

Siehe `.env.example`:

```env
VITE_COPERNICUS_CLIENT_ID=
VITE_COPERNICUS_CLIENT_SECRET=
VITE_COPERNICUS_CATALOG_URL=https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search
VITE_COPERNICUS_PROCESS_URL=https://sh.dataspace.copernicus.eu/api/v1/process
```

Fuer Produktion sollten Secrets nicht im Browser liegen. Der naechste Schritt ist ein kleiner Backend-Proxy:

- `POST /api/copernicus/catalog/search`
- `POST /api/copernicus/process`
- optional `GET /api/copernicus/tiles/:layer`

## Vorbereitete Schnittstelle

`src/copernicus.ts` enthaelt:

- `getCopernicusConfig()`
- `buildSentinelHubProcessRequest(...)`
- `generateCopernicusDemoAnalysis(...)`
- `getCopernicusLayerCells(...)`

Der echte Backend-Proxy sollte `buildSentinelHubProcessRequest` verwenden und die Ergebnisse in dieselbe `CopernicusAnalysis`-Struktur zurueckgeben.

