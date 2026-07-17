import { Observation } from "./domain";

export type TaxonGroup = "plant" | "bird";
export type IndexStatus = "EXPERIMENTAL" | "INTERNAL_VALIDATED" | "EXTERNAL_VALIDATED";

export interface SpeciesTaxon {
  taxonId: string;
  group: TaxonGroup;
  scientificName: string;
  germanName: string;
  status: string;
  habitat: string;
  atheneUse: string;
  source: string;
  detection: "image" | "audio" | "audio_image";
  sensitive: boolean;
  minConfidence: number;
}

export interface SpeciesObservationRecord {
  id: string;
  observationId: string;
  taxonId: string;
  observedAt: string;
  evidenceType: "image" | "audio";
  probability: number;
  decisionThreshold: number;
  detectionStatus: "model_candidate" | "event_grouped" | "review_required";
  reviewerStatus: "unreviewed" | "accepted" | "rejected";
  dataStatus: "synthetic";
  modelVersion: string;
}

export interface BiodiversityMetrics {
  richness: number;
  shannon: number;
  simpson: number;
  acousticActivityRate: number;
  nativePlantShare: number;
  sensitiveObservationCount: number;
  validObservationCount: number;
}

export interface IndexDefinitionDemo {
  indexCode: string;
  name: string;
  status: IndexStatus;
  version: string;
  output: string;
  inputs: string[];
  missingPolicy: string;
  confidenceRule: string;
  interpretationLimit: string;
}

export const speciesQualityRules = [
  "Wissenschaftlicher Name und Taxon-ID sind führend; deutsche Namen sind Aliasse.",
  "Eine Modellklassifikation ist kein bestätigter Artnachweis.",
  "Jede Beobachtung speichert Modell, Version, Confidence, Schwellenwert und Mission.",
  "Seltene oder schutzrelevante Arten werden im Bürgermonitor räumlich vergröbert oder verborgen.",
  "Indizes sind versioniert; Änderungen erzeugen neue Versionen.",
  "Fehlende Daten werden nicht als Null interpretiert.",
  "Experimentelle Indizes tragen sichtbar den Status EXPERIMENTAL.",
];

export const plantCatalog: SpeciesTaxon[] = [
  plant("plant-fagus-sylvatica", "Fagus sylvatica", "Gewöhnliche Buche", "heimisch", "Laub-/Buchen-/Mischwald", "Kronenstruktur, Trockenstress, Verjüngung", "FloraWeb", 0.72),
  plant("plant-quercus-robur", "Quercus robur", "Stiel-Eiche", "heimisch", "Laubmischwald, feuchtere Standorte", "Altbaumstruktur, Kronenzustand", "FloraWeb/BfN", 0.7),
  plant("plant-quercus-petraea", "Quercus petraea", "Trauben-Eiche", "heimisch", "trockenere Laubmischwälder", "Trockenheitsvergleich, Struktur", "FloraWeb/BfN", 0.7),
  plant("plant-acer-pseudoplatanus", "Acer pseudoplatanus", "Berg-Ahorn", "heimisch", "frische Laubmischwälder", "Artenmischung, Regeneration", "FloraWeb", 0.68),
  plant("plant-carpinus-betulus", "Carpinus betulus", "Hainbuche", "heimisch", "Eichen-Hainbuchenwald", "Unter-/Mittelschicht, Mischung", "FloraWeb", 0.68),
  plant("plant-fraxinus-excelsior", "Fraxinus excelsior", "Gewöhnliche Esche", "heimisch", "frische bis feuchte Wälder", "Schadbildmonitoring, Ausfall", "FloraWeb/BfN", 0.68),
  plant("plant-betula-pendula", "Betula pendula", "Hänge-Birke", "heimisch", "Pionierstandorte, Lichtungen", "Sukzession, Störungsflächen", "FloraWeb", 0.66),
  plant("plant-picea-abies", "Picea abies", "Gemeine Fichte", "heimisch regional / häufig forstlich", "Nadel-/Mischwald", "Trocken- und Schadstress", "FloraWeb/BfN", 0.72),
  plant("plant-abies-alba", "Abies alba", "Weiß-Tanne", "heimisch", "montane Mischwälder", "Verjüngung, Waldumbau", "FloraWeb/BfN", 0.7),
  plant("plant-pinus-sylvestris", "Pinus sylvestris", "Wald-Kiefer", "heimisch", "lichte, trockene Standorte", "Trockenstandorte, Kronenlücken", "FloraWeb", 0.7),
  plant("plant-pseudotsuga-menziesii", "Pseudotsuga menziesii", "Douglasie", "gebietsfremd, forstlich", "Wirtschaftswald", "Bestandsanteil, Vergleich heimisch/fremd", "BfN/Forstquelle", 0.74),
  plant("plant-prunus-serotina", "Prunus serotina", "Späte Trauben-Kirsche", "etablierter Neophyt", "lichte Wälder, Kiefernforste, Ränder", "Ausbreitung, Dominanzflächen", "FloraWeb/BfN", 0.74),
  plant("plant-ailanthus-altissima", "Ailanthus altissima", "Götterbaum", "gebietsfremd; EU-Unionsliste", "gestörte, warme Standorte/Ränder", "Früherkennung invasiver Ausbreitung", "EU IAS/BfN", 0.78, true),
  plant("plant-impatiens-glandulifera", "Impatiens glandulifera", "Drüsiges Springkraut", "gebietsfremd/invasiv", "feuchte Ränder und Gewässernähe", "Ausbreitung, Bürgerhinweise", "BfN/FloraWeb", 0.72),
  plant("plant-reynoutria-japonica", "Reynoutria japonica", "Japanischer Staudenknöterich", "gebietsfremd/invasiv", "Ränder, Ufer, gestörte Flächen", "Flächendominanz, Ausbreitungsfront", "BfN/FloraWeb", 0.76),
  plant("plant-urtica-dioica", "Urtica dioica", "Große Brennnessel", "heimisch", "nährstoffreiche Säume und Lichtungen", "Nährstoff-/Störungsproxy, Bürgerhinweis", "FloraWeb", 0.66),
];

export const birdCatalog: SpeciesTaxon[] = [
  bird("bird-parus-major", "Parus major", "Kohlmeise", "häufig", "Wald, Park, Siedlung", "Aktivität, allgemeine Habitatnutzung", "DDA/BfN", "audio_image", 0.68),
  bird("bird-cyanistes-caeruleus", "Cyanistes caeruleus", "Blaumeise", "häufig", "Laub-/Mischwald, Gehölze", "Aktivität, Höhlenangebot indirekt", "DDA/BfN", "audio_image", 0.68),
  bird("bird-erithacus-rubecula", "Erithacus rubecula", "Rotkehlchen", "häufig", "strukturreiche Wälder/Unterholz", "Unterwuchs- und Aktivitätsbezug", "DDA/BfN", "audio", 0.66),
  bird("bird-turdus-merula", "Turdus merula", "Amsel", "häufig", "Wald, Rand, Siedlung", "Aktivität, saisonaler Vergleich", "DDA/BfN", "audio_image", 0.66),
  bird("bird-fringilla-coelebs", "Fringilla coelebs", "Buchfink", "häufig", "Wälder und Gehölze", "häufige Referenzart", "DDA/BfN", "audio", 0.66),
  bird("bird-sitta-europaea", "Sitta europaea", "Kleiber", "häufig", "Laub-/Mischwald, Altbäume", "Altbaum-/Höhlenstrukturbezug", "DDA/BfN", "audio_image", 0.7),
  bird("bird-certhia-familiaris", "Certhia familiaris", "Waldbaumläufer", "häufig", "Wald, Stammstruktur", "Baumstrukturbezug", "DDA/BfN", "audio_image", 0.7),
  bird("bird-dendrocopos-major", "Dendrocopos major", "Buntspecht", "häufig", "Wald und Gehölze", "Totholz-/Baumstrukturbezug", "DDA/BfN", "audio_image", 0.7),
  bird("bird-dryocopus-martius", "Dryocopus martius", "Schwarzspecht", "schutzrelevant", "größere Waldgebiete, Altbäume", "strukturbezogene Zielart; sensible Ausgabe", "DDA/BfN", "audio_image", 0.76, true),
  bird("bird-dendrocoptes-medius", "Dendrocoptes medius", "Mittelspecht", "schutzrelevant", "alte Laub-/Eichenwälder", "Laubaltwaldbezug; fachliche Prüfung", "DDA/BfN", "audio_image", 0.76, true),
  bird("bird-strix-aluco", "Strix aluco", "Waldkauz", "Brutvogel", "Wälder mit Höhlenbäumen", "Nachtmonitoring, Höhlenstruktur", "DDA/BfN", "audio", 0.76, true),
  bird("bird-phylloscopus-sibilatrix", "Phylloscopus sibilatrix", "Waldlaubsänger", "Saisonart", "Laubwälder", "Waldstruktur und Saison", "DDA/BfN", "audio", 0.7),
  bird("bird-troglodytes-troglodytes", "Troglodytes troglodytes", "Zaunkönig", "häufig", "dichtes Unterholz", "Unterwuchs-/Strukturaktivität", "DDA/BfN", "audio", 0.66),
  bird("bird-garrulus-glandarius", "Garrulus glandarius", "Eichelhäher", "häufig", "Wälder", "Aktivität; Samenverbreitung als Kontext", "DDA/BfN", "audio_image", 0.68),
  bird("bird-columba-palumbus", "Columba palumbus", "Ringeltaube", "häufig", "Wald, Gehölze, Siedlung", "häufige Referenzart", "DDA/BfN", "audio_image", 0.66),
  bird("bird-cuculus-canorus", "Cuculus canorus", "Kuckuck", "Saisonart", "Waldränder und vielfältige Landschaften", "Phänologie und saisonale Präsenz", "DDA/BfN", "audio", 0.72),
];

export const speciesCatalog = [...plantCatalog, ...birdCatalog];

export const indexDefinitionsDemo: IndexDefinitionDemo[] = [
  {
    indexCode: "DRYNESS_STRESS_V1",
    name: "Atmosphärischer Trockenstress",
    status: "EXPERIMENTAL",
    version: "1.0.0",
    output: "0-100, höher schlechter",
    inputs: ["Temperatur p90", "relative Luftfeuchte p10"],
    missingPolicy: "FAIL_IF_COVERAGE_BELOW 0.70",
    confidenceRule: "Datenqualität × Abdeckung × Aktualität",
    interpretationLimit: "experimenteller Lageindikator; kein Boden-Dürreindex",
  },
  {
    indexCode: "FOREST_BIRD_HABITAT_V1",
    name: "Vogelarten-Habitatindex",
    status: "EXPERIMENTAL",
    version: "1.0.0",
    output: "0-100 relativ zum Referenzraum",
    inputs: ["gültige Audioevents", "Zielartgewichte", "Audioqualität", "Effort Coverage"],
    missingPolicy: "ignore-and-reweight nur bei dokumentiertem Ausschluss",
    confidenceRule: "Modellpräzision × Audioqualität × Erfassungsaufwand",
    interpretationLimit: "Artengruppe fachlich definieren; keine direkte Bestandszahl",
  },
  {
    indexCode: "INVASIVE_PLANT_PRESSURE_V1",
    name: "Invasiver Pflanzendruck",
    status: "EXPERIMENTAL",
    version: "1.0.0",
    output: "0-100, höher schlechter",
    inputs: ["invasive Taxa", "Flächenanteil", "Persistenz", "Ausbreitungsrate"],
    missingPolicy: "fail bei fehlender Taxonquelle oder geringer Sichtabdeckung",
    confidenceRule: "Modellgüte × räumliche Nähe × Reviewstatus",
    interpretationLimit: "taxonspezifische Gewichtung und Georegistrierung erforderlich",
  },
  {
    indexCode: "VEGETATION_DIVERSITY_V1",
    name: "Vegetationsdiversität",
    status: "EXPERIMENTAL",
    version: "1.0.0",
    output: "0-100",
    inputs: ["Richness", "Shannon", "Schichtdiversität"],
    missingPolicy: "neutral nur für explizit nicht sichtbare Schichten",
    confidenceRule: "Sichtbarkeit × Modellconfidence × Reviewstatus",
    interpretationLimit: "nur sichtbare Taxa/Schichten im Messkorridor",
  },
];

export function generateSpeciesObservations(observations: Observation[]): SpeciesObservationRecord[] {
  const records: SpeciesObservationRecord[] = [];
  observations.forEach((observation, index) => {
    observation.detections.forEach((detection, detectionIndex) => {
      const taxon = mapDetectionToTaxon(detection.label, index);
      if (!taxon) return;
      const probability = Math.max(taxon.minConfidence - 0.04, Math.min(0.98, detection.confidence));
      records.push({
        id: `species-${observation.id}-${detectionIndex}`,
        observationId: observation.id,
        taxonId: taxon.taxonId,
        observedAt: observation.timestamp,
        evidenceType: taxon.group === "bird" && taxon.detection === "audio" ? "audio" : "image",
        probability,
        decisionThreshold: taxon.minConfidence,
        detectionStatus: taxon.sensitive || probability < taxon.minConfidence + 0.04 ? "review_required" : "event_grouped",
        reviewerStatus: "unreviewed",
        dataStatus: "synthetic",
        modelVersion: observation.generatorVersion,
      });
    });
  });
  return records;
}

export function calculateBiodiversityMetrics(records: SpeciesObservationRecord[]): BiodiversityMetrics {
  const valid = records.filter((record) => record.probability >= record.decisionThreshold);
  const counts = new Map<string, number>();
  valid.forEach((record) => counts.set(record.taxonId, (counts.get(record.taxonId) ?? 0) + 1));
  const total = valid.length || 1;
  const proportions = Array.from(counts.values()).map((count) => count / total);
  const plantRecords = valid.filter((record) => findTaxon(record.taxonId)?.group === "plant");
  const nativePlants = plantRecords.filter((record) => findTaxon(record.taxonId)?.status.includes("heimisch")).length;
  return {
    richness: counts.size,
    shannon: round(-proportions.reduce((sum, p) => sum + p * Math.log(p), 0), 2),
    simpson: round(1 - proportions.reduce((sum, p) => sum + p * p, 0), 2),
    acousticActivityRate: round(valid.filter((record) => record.evidenceType === "audio").length / 1.25, 1),
    nativePlantShare: plantRecords.length === 0 ? 0 : round(nativePlants / plantRecords.length, 2),
    sensitiveObservationCount: valid.filter((record) => findTaxon(record.taxonId)?.sensitive).length,
    validObservationCount: valid.length,
  };
}

export function findTaxon(taxonId: string): SpeciesTaxon | undefined {
  return speciesCatalog.find((taxon) => taxon.taxonId === taxonId);
}

function mapDetectionToTaxon(label: string, index: number): SpeciesTaxon | undefined {
  if (label.includes("Fichte")) return plantCatalog.find((taxon) => taxon.scientificName === "Picea abies");
  if (label.includes("Buche")) return plantCatalog[index % 3 === 0 ? 1 : 0];
  if (label.includes("Buntspecht")) return birdCatalog.find((taxon) => taxon.scientificName === "Dendrocopos major");
  if (label.includes("Amsel")) return birdCatalog.find((taxon) => taxon.scientificName === "Turdus merula");
  if (label.includes("Trockenstress")) return plantCatalog[index % plantCatalog.length];
  if (label.includes("Sturmschaden")) return birdCatalog.find((taxon) => taxon.scientificName === "Dendrocopos major");
  if (label.includes("Schädlingsbefall")) return plantCatalog.find((taxon) => taxon.scientificName === "Fraxinus excelsior");
  return undefined;
}

function plant(taxonId: string, scientificName: string, germanName: string, status: string, habitat: string, atheneUse: string, source: string, minConfidence: number, sensitive = false): SpeciesTaxon {
  return { taxonId, group: "plant", scientificName, germanName, status, habitat, atheneUse, source, detection: "image", sensitive, minConfidence };
}

function bird(taxonId: string, scientificName: string, germanName: string, status: string, habitat: string, atheneUse: string, source: string, detection: SpeciesTaxon["detection"], minConfidence: number, sensitive = false): SpeciesTaxon {
  return { taxonId, group: "bird", scientificName, germanName, status, habitat, atheneUse, source, detection, sensitive, minConfidence };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
