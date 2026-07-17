# Project Athene Context

Diese Datei ist verbindlicher Projektkontext fuer Codex-Arbeit in diesem Repository.

## Produktbild

Athene ist keine neue Sensorplattform. Athene ist die Analyse-, Simulations- und Visualisierungsschicht ueber Artemis. Ziel ist eine raeumlich und zeitlich nachvollziehbare Lagebeschreibung von Waldzustaenden mit sichtbarer Unsicherheit, Herkunft und Handlungskontext.

Die UI ist kartenzentriert. Diagramme, Detailkarten, Medienansichten und Mission Playback erklaeren den aktuell ausgewaehlten Ort, Zeitraum oder Layer.

## Datenregeln

Jeder relevante Datenwert muss mindestens folgende Metadaten tragen:

- `data_origin`: real oder synthetisch.
- `data_status`: measured, simulated, derived, interpolated, modeled oder unknown.
- `confidence`: belastbarer Score oder explizit fehlend.
- `source`: Mission, Sensor, Modell, Generator oder Freigabequelle.
- `timestamp` beziehungsweise Zeitraum.
- `model_version` oder `generator_version`, wenn ein Wert berechnet oder simuliert wurde.

Simulierte Daten duerfen in UI, Exporten, APIs und Tests nie mit realen Messdaten verwechselt werden.

## Fachliche Grenzen

- Keine wissenschaftlich validierte Waldbrandvorhersage allein aus simulierten Daten behaupten.
- Keine flaechendeckenden Messwerte ausserhalb beobachteter oder explizit modellierter Bereiche behaupten.
- Unbekannte Flaechen grau/dunkel oder anderweitig klar als unbekannt darstellen.
- Oeffentliche Warnungen nur aus freigegebenen, geprueften Informationen ableiten.
- Sensible Details kostenguenstiger stationaerer Sensortechnologien nicht oeffentlich dokumentieren.

## Technische Richtung

Bevorzugte Zielarchitektur aus der Project Note:

- PostgreSQL/PostGIS fuer Gebiete, Wege, Geometrien, Missionen und Modellmetadaten.
- Zeitreihen zunaechst in InfluxDB oder ueber eine Integrationsschicht.
- Medien im Object Storage.
- Kartenlayer als Vektor- oder Rasterkacheln, nicht als komplette Rohdaten im Browser.
- GeoJSON oder kompatible PostGIS-Geometrien fuer APIs.
- Getrennte interne Analyse-Endpunkte und oeffentliche Endpunkte.

## MVP-Fokus

Priorisiere Arbeit, die eine durchgaengige Demo ermoeglicht:

1. Gebiet als Polygon anlegen.
2. Waldwege und Wegpunkte manuell erfassen.
3. Szenario konfigurieren.
4. Reproduzierbare Mock-Mission per Seed erzeugen.
5. Sensor-Zeitreihen und einfache Detektionen darstellen.
6. Messkorridor, Interpolation, unbekannte Flaechen und Confidence visualisieren.
7. Einfachen internen Trockenstressindex berechnen.
8. Master Map, Zeitverlauf und Mission Playback verbinden.
9. Reduzierten, manuell freigeschalteten Buergermonitor bereitstellen.

## Quelle

Der vollstaendige Ausgangskontext liegt in `docs/source/Project_Athene_Project_Note_v0.1.docx`; die verdichtete Arbeitsfassung liegt in `docs/project-context.md`.

