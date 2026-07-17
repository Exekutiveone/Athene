# Project Athene: Projektkontext

Quelle: `Project_Athene_Project_Note_v0.1.docx`, Version 0.1, Konzeptentwurf, Stand 16. Juli 2026.

## Kurzfassung

Project Athene ist die strategische Auswertungs- und Visualisierungsschicht oberhalb der Artemis-Datenplattform. Artemis verwaltet Fahrzeuge, Missionen, Zeitreihen, Kamera- und Audiodaten sowie daraus gewonnene Detektionen. Athene macht diese Informationen als Kartenlayer, Zeitverlaeufe, Indikatoren, Szenarien und Entscheidungsgrundlagen nutzbar.

Der erste Entwicklungsstand soll ohne grosse Menge realer Walddaten funktionieren. Ein reproduzierbarer Mock-Datengenerator erzeugt synthetische Missionen fuer manuell angelegte Waldgebiete und Waldwege. Nutzer waehlen Waldtyp, Jahreszeit, Belastung und weitere Rahmenbedingungen; Athene simuliert eine UGV-Fahrt, passende Sensordaten, raeumliche Muster, Detektionen und Unsicherheiten.

Die Karte ist die primaere Arbeitsflaeche. Messungen entlang der Route werden in einen konfigurierbaren raeumlichen Korridor projiziert. Die Aussagekraft nimmt mit zunehmender Entfernung von der Messroute ab. Bereiche ohne belastbare Grundlage bleiben sichtbar grau oder dunkel.

## Produktidee

Athene steht innerhalb des Artemis-Systems fuer Strategie, Auswertung und vorausschauende Entscheidungen. Es ist kein zusaetzlicher Sensor-Stack, sondern eine Anwendungsschicht, die vorhandene Daten verstaendlich, vergleichbar und entscheidungsrelevant macht.

### Ziele

- Realistische Mock-Daten und Missionen fuer Demonstration, Entwicklung und Tests erzeugen.
- Waldgebiete, Wege, Routen, Messpunkte und raeumliche Datenabdeckung auf einer Karte darstellen.
- Rohwerte, Zeitverlaeufe, Detektionen, Indikatoren und Risikoebenen gemeinsam nutzbar machen.
- Unbekannte und unsichere Flaechen bewusst sichtbar halten.
- Fachliche Use Cases aus derselben Datenbasis ableiten, ohne separate Datensilos aufzubauen.
- Ergebnisse fuer Experten, Betreiber, Kommunen und Buerger unterschiedlich aufbereiten.

### Nicht-Ziele des ersten Prototyps

- Keine wissenschaftlich validierte Vorhersage realer Waldbraende allein aus simulierten Daten.
- Keine vollautomatische Kartierung saemtlicher Waldwege.
- Keine flaechendeckende Behauptung von Messwerten ausserhalb des beobachteten Korridors.
- Keine oeffentliche Offenlegung sensibler Details stationaerer Sensortechnologien.
- Keine endgueltige Festlegung aller oekologischen Indizes.

## Mock-Daten und simulierte Missionen

Der Mock-Datengenerator erzeugt keine zufaellige Sammlung plausibler Zahlen, sondern konsistente Szenarien mit nachvollziehbaren Ursache-Wirkungs-Beziehungen. Alle synthetischen Datensaetze muessen durch Seed, Parametersatz und Generatorversion exakt reproduzierbar sein.

### Scenario-Builder-Eingaben

| Parametergruppe | Beispiele |
| --- | --- |
| Gebiet | Waldgrenze, Name, Verwaltungszustaendigkeit, Flaechengroesse, optional Hoehenmodell |
| Wege | Wegpunkte, Linienverlauf, Befahrbarkeit, Breite, optional Wegklasse |
| Waldtyp | Nadelwald, Laubwald, Mischwald, naturwaldnah, Aufforstungsflaeche |
| Zeitkontext | Jahreszeit, Datum, Uhrzeit, Sonnenstand, Missionsdauer |
| Wetterlage | Temperaturbereich, Luftfeuchte, Luftdruck, Niederschlagsvorgeschichte, Bewoelkung |
| Belastung | Trockenstress, Schadstoffbelastung, Schaedlingsdruck, invasive Arten, Stoerung |
| Biologie | Baumartenmix, Vegetationsdichte, Vogelarten-Pool, Aktivitaetsniveau |
| Mission | Fahrzeug, Route, Geschwindigkeit, Haltepunkte, Sensorprofil, Samplingraten |
| Reproduzierbarkeit | Random Seed, Generatorversion, Szenarioversion, Parametersatz |

### Generierungslogik

1. Athene erzeugt ein raeumliches Grundfeld fuer Umweltgroessen, zum Beispiel Temperaturgradienten entlang von Exposition, Kronendichte oder Belastungszonen.
2. Die simulierte Route wird zeitlich parametrisiert. Jeder Wegpunkt erhaelt Zeitpunkt, Geschwindigkeit und interpolierte Fahrzeugposition.
3. Sensorwerte werden aus dem Grundfeld abgeleitet und um Rauschen, Drift, Verzoegerung und Ausfaelle ergaenzt.
4. Kamera- und Audiodaten werden im MVP primaer ueber Metadaten und Detektionsereignisse simuliert.
5. Aus Rohdaten werden dieselben Auswertungsschritte ausgefuehrt, die spaeter auch fuer reale Missionen gelten.

## Raeumliches Modell und Datenabdeckung

Die belastbarste raeumliche Information liegt direkt auf der gefahrenen Route beziehungsweise an GPS-synchronisierten Messpunkten. Fuer visuelle und akustische Beobachtungen kann zusaetzlich ein Sicht- oder Hoerbereich modelliert werden.

Fuer den ersten Prototyp ist ein konfigurierbarer Einflusskorridor von etwa 20 bis 30 Metern beidseitig der Route vorgesehen. Dieser Radius ist eine Darstellungs- und Modellannahme, keine pauschale oekologische Wahrheit. Er kann je Datenlayer unterschiedlich sein.

| Zone | Bedeutung | Darstellung |
| --- | --- | --- |
| Messkern | Route oder direkt beobachteter Bereich | Kraeftige Layerfarbe, hoechste Confidence |
| Unterstuetzte Umgebung | Raeumliche Uebertragung in begrenztem Radius | Abnehmende Deckkraft, Distanzhinweis |
| Modellierter Bereich | Schaetzung aus Missionen, Kontext- oder Ferndaten | Eigene Schraffur oder Farbkodierung |
| Unbekannter Bereich | Keine belastbare Datengrundlage | Grau oder dunkel, keine scheinpraezisen Werte |

Jeder Kartenwert erhaelt einen Confidence-Wert. Die Confidence beruecksichtigt mindestens Distanz zur Route, Alter der Messung, Anzahl unabhaengiger Missionen, Sensorqualitaet, Datenvollstaendigkeit und Eignung des raeumlichen Modells.

## Layer- und Indikatormodell

| Ebene | Inhalt | Beispiel |
| --- | --- | --- |
| L0 - Quelle | Rohdaten und originale Medienreferenzen | Temperaturmessung, Audiosegment, Kameraframe |
| L1 - Bereinigung | Kalibrierte, qualitaetsgepruefte Messdaten | Temperatur ohne Ausreisser, korrigierter Timestamp |
| L2 - Detektion | ML- oder regelbasierte Ereignisse | Vogelart erkannt, Fichte detektiert, Totholzbereich |
| L3 - Kennwert | Direkt berechnete Metrik | Tagesmittel, Kronenoffenheit, akustische Aktivitaet |
| L4 - Index | Kombination mehrerer Kennwerte | Mikroklimatischer Trockenstress, Luftbelastung |
| L5 - Lagebild | Use-Case-Bewertung und Handlungskontext | Waldbrand-Screeningzone, Aufforstung unter Plan |

### Vorgesehene Rohwert-Layer

- Temperatur, relative Luftfeuchtigkeit und Luftdruck.
- VOC-Index, CO2-Konzentration sowie PM1, PM2.5 und PM10.
- Zwei Lux-Werte beziehungsweise Lichtmessungen mit definierter Orientierung.
- Zukuenftig Bodentemperatur, Bodenfeuchte und weitere Bodenparameter.
- Kamera- und Audiodaten als zeit- und ortssynchronisierte Medien oder Detektionsquellen.
- GPS, Zeit, Mission, Fahrzeug, Sensor, Kalibrierung und Qualitaetsstatus als Kontext jeder Beobachtung.

### Erste Indikatorkandidaten

| Index | Moegliche Eingaenge | Zweck |
| --- | --- | --- |
| Mikroklimatischer Trockenstressindex | Temperatur, Luftfeuchte, optional Bodenfeuchte und Niederschlagsvorgeschichte | Screening fuer warme und trockene Teilbereiche |
| Waldbrand-Risiko-Screening | Trockenstress, Vegetationszustand, Wind/Niederschlag, Brennstofffeuchte, historische Lage | Priorisierung weiterer Pruefung, kein alleiniger Alarmgeber |
| Kronenoffenheits-/Lichtindex | Lux-Verhaeltnis, Tageszeit, Kameramerkmale | Vergleich von Lichtdurchlaessigkeit und Kronendichte |
| Luftbelastungsindex | PM1, PM2.5, PM10, VOC, Kontext | Lokale Belastung und zeitliche Anomalien |
| Akustischer Aktivitaetsindex | Schalldruckmerkmale, Bioakustik, Tageszeit, Wetter | Veraenderung biologischer Aktivitaet |
| Arten- und Strukturdiversitaet | Vegetationsdetektionen, Haeufigkeiten, raeumliche Verteilung | Vergleich beobachteter Vegetationsstruktur |
| Vegetationszustandsindex | Farbe, Textur, Schaeden, Trockenheit, Totholz, Wiederholungsmessungen | Veraenderungen des sichtbaren Vegetationszustands |
| Aufforstungsfortschritt | Ueberleben, Wachstum, Dichte, Diversitaet, Mikroklima | Entwicklung gegenueber Baseline und Ziel |
| Observation Confidence | Distanz, Aktualitaet, Abdeckung, Qualitaet, Modellguete | Transparenz ueber Belastbarkeit aller Kartenwerte |

Ein MVP-Trockenstressindex darf als Artemis-interner Screeningindex verwendet werden. Er darf nicht mit etablierten meteorologischen Duerreindizes gleichgesetzt werden.

## Nutzeroberflaeche und Ansichten

Karte, Diagramme, Detailkarten und Medienansichten sollen zusammenarbeiten. Nutzer sollen nicht zwischen isolierten Dashboards springen muessen, sondern raeumliche und zeitliche Analyse in einer gemeinsamen Oberflaeche durchfuehren.

### Kerninteraktionen

- Gebiet, Mission, Zeitraum und Kartenlayer auswaehlen.
- Zeitachse bewegen und raeumliche Veraenderungen als Animation oder Zeitschnitt darstellen.
- Kartenpunkt oder Flaeche anklicken und Rohwerte, Indexbeitraege, Detektionen und Confidence oeffnen.
- Zwischen Messwert, abgeleitetem Index und fachlichem Lagebild wechseln.
- Mission entlang der Route wiedergeben und synchronisierte Kamera-/Audiosegmente oeffnen.
- Layer vergleichen, zum Beispiel Temperatur gegen Vegetationszustand.
- Ergebnis als Bericht, Kartenausschnitt oder oeffentlichen Hinweis exportieren.

### Vorgesehene Ansichten

| Ansicht | Zielgruppe | Funktionen |
| --- | --- | --- |
| Scenario Builder | Entwicklung, Produktdemo | Gebiet, Wege, Parameter und Mock-Missionen erzeugen |
| Master Map | Betreiber, Analysten, Kommunen | Alle Layer, Confidence, Vergleiche, Alerts und Freigaben |
| Mission Playback | Technik, QS, Forschung | Route, Zeitreihen, Video/Audio und Detektionen synchron pruefen |
| Waldbrandmonitor | Forst, Kommune, Einsatzplanung | Risikozonen, Trends, Messluecken und Sensorplatzierung |
| Aufforstungsmonitor | Forst, Projekttraeger, Foerdergeber | Baseline, Ziel, Wachstum, Ausfaelle und Wirkungskennwerte |
| Buergermonitor | Oeffentlichkeit | Freigegebene Zustaende, Hinweise, Missionen und Erklaerungen |

## Kern-Use-Cases

### Waldbrandmonitor

Der Waldbrandmonitor ist ein Screening- und Priorisierungssystem. Mobile UGV-Missionen identifizieren Teilbereiche mit auffaelligem Trockenstress, Vegetationszustand oder wiederkehrenden Anomalien. Athene markiert diese Zonen und schlaegt Standorte fuer zusaetzliche stationaere Messpunkte vor.

Ein Waldbrandalarm darf im Produktivbetrieb nicht allein aus einem einfachen Temperatur-Luftfeuchte-Index entstehen. Fuer belastbare Warnungen sind validierte Modelle, weitere Wetter- und Brennstoffdaten, fachliche Schwellenwerte und definierte Eskalationsprozesse erforderlich.

### Aufforstungsmonitor

Athene begleitet Aufforstungsflaechen ueber wiederholte Missionen. Vor Beginn wird eine Baseline angelegt. Anschliessend werden Ueberlebensrate, sichtbares Wachstum, Vegetationsdichte, Artenmix, Lichtverhaeltnisse, Mikroklima und raeumliche Ausbreitung verglichen.

| Phase | Auswertung |
| --- | --- |
| Baseline | Ausgangszustand, Boden-/Mikroklima, vorhandene Vegetation, Referenzflaechen |
| Fruehphase | Anwuchs, Ausfaelle, Bewaesserungs-/Trockenstress, invasive Konkurrenz |
| Etablierung | Wachstum, Dichte, Diversitaet, Kronenentwicklung, Mikroklimaeffekte |
| Langfristige Wirkung | Stabilitaet, Artenzusammensetzung, Kuehlung, Kohlenstoff- und Habitatindikatoren |

### Buergermonitor

Der Buergermonitor veroeffentlicht ausschliesslich gepruefte und freigegebene Daten. Er kann verstaendliche Zustandsinformationen, zeitliche Veraenderungen, laufende Missionen und lokale Hinweise zeigen.

Wichtige Grenzen:

- Keine ungepruefte Veroeffentlichung automatischer Detektionen als Tatsache.
- Trennung zwischen Information, Vorsichtshinweis und offizieller Warnung.
- Datenschutz- und Persoenlichkeitsfilter fuer Video- und Audiodaten.
- Zeitverzoegerung oder Ausschnittbeschraenkung bei Live-Feeds, sofern erforderlich.
- Erklaeransicht fuer Daten, Modelle und Pruefungen.

## Technische Zielarchitektur

Athene greift auf die bestehende Artemis-Datenplattform zu und ergaenzt sie um georaeumliche Verarbeitung, Simulation, Layer-Caching, Indexversionierung und rollenbasierte Veroeffentlichungen.

Empfohlene Bausteine:

- PostgreSQL mit PostGIS fuer Gebiete, Wege, Geometrien, Missionen und Modellmetadaten.
- Zeitreihen zunaechst in InfluxDB oder ueber eine Integrationsschicht.
- Medien im Object Storage.
- Layer-Caching fuer Kartenansichten.
- Getrennte interne und oeffentliche API-Oberflaechen.

### Neue oder erweiterte Datenobjekte

| Objekt | Zweck |
| --- | --- |
| `scenario` | Parametersatz einer simulierten Wald- und Belastungssituation |
| `scenario_version` | Versionierte, reproduzierbare Definition des Generators |
| `forest_area` / `management_unit` | Waldgebiet, Teilflaeche und Zustaendigkeit |
| `forest_path` / `waypoint` | Manuell oder importiert angelegte Wege und Wegpunkte |
| `simulated_mission` | Mission mit Kennzeichnung als synthetisch und Referenz auf Seed |
| `layer_definition` | Definition eines Rohwert-, Detektions-, Index- oder Lagebildlayers |
| `layer_snapshot` | Berechneter raeumlicher Stand eines Layers zu Zeitpunkt oder Zeitraum |
| `coverage_cell` | Raster-/Vektorzelle mit Wert, Herkunft, Confidence und Aktualitaet |
| `indicator_definition` | Formel, Eingaenge, Normalisierung, Gewichtung und Version |
| `alert_candidate` | Automatisch erzeugter, noch ungepruefter Hinweis |
| `publication` | Freigegebener Inhalt fuer Buerger- oder Partneransicht |
| `stationary_sensor_recommendation` | Vorgeschlagene Position und Begruendung ohne sensible Bauinformationen |

### API-Grundsaetze

- Geometrien standardisiert als GeoJSON oder kompatible PostGIS-Geometrien bereitstellen.
- Kartenlayer als Vektor- oder Rasterkacheln ausliefern.
- Grosse Rohdaten nicht vollstaendig an den Browser uebertragen.
- Zeitreihen nach Mission, Layer, Gebiet, Zeitraum und Aggregationsstufe abfragen.
- Fuer jeden Wert Herkunft, Datenstatus, Confidence und Modellversion mitsenden.
- Oeffentliche Endpunkte strikt von internen Analyse- und Rohdatenendpunkten trennen.

## Datenqualitaet, Governance und Freigaben

Athene erzeugt durch raeumliche Interpolation und Indizes Aussagen, die ueber einzelne Messungen hinausgehen. Governance ist deshalb Produktbestandteil.

| Regel | Umsetzung |
| --- | --- |
| Real und synthetisch trennen | Pflichtfeld `data_origin`, getrennte Filter, Exporte und visuelle Kennzeichnung |
| Unsicherheit sichtbar machen | Confidence-Layer, Deckkraft, Schraffur, Warnhinweise und unbekannte Flaechen |
| Modelle versionieren | Formel, Gewichte, Trainingsstand, Parameter und Gueltigkeitszeitraum speichern |
| Freigaben kontrollieren | Vier-Augen-Prinzip oder definierte Rollen fuer oeffentliche Warnungen |
| Datenschutz sichern | Gesichts-/Kennzeichenfilter, Audiopruefung, Aufbewahrungsregeln, Zugriffsprotokolle |
| Ergebnisse reproduzieren | Mission, Inputs, Code-/Modellversion und Berechnungsjob referenzieren |
| Fehler korrigieren | Ergebnisse zurueckziehen, neu berechnen und Aenderungen protokollieren |

## MVP-Schnitt

### Funktionsumfang

- Ein Waldgebiet als Polygon anlegen und Zustaendigkeit hinterlegen.
- Waldwege als Linien mit Wegpunkten manuell erfassen.
- Szenario aus Waldtyp, Jahreszeit, Wetter und Belastungsstufe konfigurieren.
- Reproduzierbare Mission mit GPS-Pfad und ausgewählten Mock-Zeitreihen erzeugen.
- Temperatur, Luftfeuchte, CO2, VOC, PM, Lux sowie einfache Baum-/Vogel-Detektionen darstellen.
- Messkorridor, Interpolation, unbekannte Flaechen und Confidence visualisieren.
- Mindestens einen einfachen internen Trockenstressindex berechnen.
- Karte, Zeitverlauf und Mission Playback in einer Masteransicht kombinieren.
- Reduzierten, manuell freigeschalteten Buergermonitor bereitstellen.

### Umsetzungsstufen

| Stufe | Ergebnis |
| --- | --- |
| A - Kartenbasis | Gebiete, Wege, Wegpunkte, Missionen und Layer-Grundgeruest |
| B - Mock Engine | Reproduzierbare Zeitreihen und Detektionsereignisse |
| C - Geospatial Engine | Korridor, Raster, Confidence und Zeit-Snapshots |
| D - Indicator Engine | Versionierte Formeln und erste Indizes |
| E - Master UI | Layerwahl, Zeitachse, Charts, Mission Playback |
| F - Use Cases | Waldbrand-Screening und Aufforstungsmonitor |
| G - Public View | Freigaben, Hinweise, Erklaeransicht und optionaler Live-Modus |

### Abnahmekriterien

- Ein Nutzer kann ohne Programmierung Gebiet, Route und Szenario anlegen.
- Derselbe Seed erzeugt denselben Datensatz und dieselben Layer.
- Jeder sichtbare Kartenwert zeigt Herkunft, Zeitpunkt, Status und Confidence.
- Unbekannte Flaechen bleiben erkennbar und erhalten keine scheinpraezisen Werte.
- Die Mission laesst sich entlang der Route abspielen; Karte und Diagramm bleiben synchron.
- Ein Index kann ueber eine neue Version veraendert werden, ohne aeltere Ergebnisse zu ueberschreiben.
- Oeffentliche Inhalte werden nur nach expliziter Freigabe sichtbar.

## Offene Entscheidungen

| Thema | Zu klaerende Frage |
| --- | --- |
| Kartenbasis | OpenStreetMap/oeffentliche Geodaten, eigener Tileserver oder kommerzieller Dienst? |
| Wegmodell | Rein manuell, Import vorhandener Wege oder halbautomatische Erkennung? |
| Raeumliche Reichweite | Welche Radien und Modelle gelten pro Sensor- und Detektionsart? |
| Rasteraufloesung | Welche Zellgroesse ist fuer Demo, Betrieb und Performance angemessen? |
| Zeitmodell | Punktzeit, Zeitfenster, Tagesaggregat und saisonale Baselines? |
| Mock-Medien | Nur Detektionsmetadaten oder generische Beispielclips/Frames? |
| Indexkatalog | Welche ersten 3-5 Indizes werden fachlich priorisiert und validiert? |
| Waldbrandmonitor | Welche externen Wetter-, Niederschlags- und Warnquellen werden integriert? |
| Live-Feed | Rohstream, zeitverzoegert, ereignisbasiert oder kuratierte Ausschnitte? |
| Buergermonitor | Welche Informationen sind oeffentlich nuetzlich, rechtlich zulaessig und nicht missverstaendlich? |
| Technologiestack | Frontend-Framework, Geoserver/Tiles, Job-Orchestrierung und API-Design? |

## Beispiel: simuliertes Szenario

| Parameter | Beispielwert |
| --- | --- |
| Gebiet | ES-001, kommunaler Mischwald, 42 ha |
| Route | 3,8 km, 126 Wegpunkte, 75 Minuten |
| Waldtyp | Mischwald mit trockener Suedhangzone |
| Zeit | Juli, 13:00-14:15 Uhr, geringe Bewoelkung |
| Belastung | Moderater Trockenstress, lokaler Schaedlingsverdacht |
| Sensoren | Temperatur, RH, Druck, CO2, VOC, PM1/2.5/10, 2x Lux, 3x RGB, Audio |
| Detektionen | Baumarten, sichtbare Schaeden, Vogelarten, akustische Aktivitaet |
| Layer | Temperatur, RH, Trockenstress, Baumarten, Vogelereignisse, Confidence |
| Seed | ATHENE-ES001-202607-013 |

Das Szenario dient ausschliesslich Entwicklung und Demonstration. Alle Karten, Zeitreihen und Detektionen werden als simuliert gekennzeichnet.

## Datenstatus fuer die Benutzeroberflaeche

| Status | Definition | Empfohlene Kennzeichnung |
| --- | --- | --- |
| Gemessen | Direkt aus realem Sensor- oder Medieninput | Durchgezogene Darstellung, Quellnachweis |
| Simuliert | Vom Mock-Datengenerator erzeugt | Deutliches SIM-Badge, eigene Layerkennung |
| Abgeleitet | Aus einer oder mehreren Quellen berechnet | Formel-/Modellhinweis |
| Interpoliert | Raeumlich oder zeitlich zwischen Beobachtungen geschaetzt | Abnehmende Deckkraft oder Schraffur |
| Modelliert | Ergebnis eines statistischen oder ML-Modells | Modellversion und Confidence |
| Unbekannt | Keine ausreichende Datengrundlage | Grau/dunkel, kein numerischer Wert |

## Empfohlener naechster Schritt

Als naechstes sollte ein praezises Screen- und Datenflusskonzept fuer den MVP entstehen:

1. Scenario Builder.
2. Master Map.
3. Mission Playback.

Parallel sollten `scenario`, `forest_path`, `layer_definition`, `coverage_cell` und `indicator_definition` in ein technisches ERM ueberfuehrt werden.

