import { Coordinate, DeploymentArea } from "./domain.js";

export interface OsmForestPath { id: number; name: string; highway: string; coordinates: Coordinate[] }
interface OverpassWayResponse { elements?: Array<{ type: "way"; id: number; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> }>; paths?: OsmForestPath[] }
interface BrowserCacheEntry { paths?: OsmForestPath[]; cachedAt?: number }

const memoryCache = new Map<string, OsmForestPath[]>();
const cacheIndexKey = "athene.osmForestPaths.lru.v4";
const cacheMaxAgeMs = 24 * 60 * 60 * 1_000;
const browserRuntime = globalThis as typeof globalThis & { localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void } };

export async function fetchOsmForestPaths(area: DeploymentArea, signal: AbortSignal, onProgress: (progress: number) => void = () => undefined): Promise<OsmForestPath[]> {
  const bounds = coordinateBounds(area.polygon);
  if (!bounds) return [];
  const [[south, west], [north, east]] = bounds;
  const query = `[out:json][timeout:20];way["highway"~"^(track|path|footway|bridleway|cycleway|service|unclassified)$"](${south},${west},${north},${east});out geom;`;
  const cacheKey = `athene.osmForestPaths.v4.${area.id}.${area.updatedAt}`;
  const cached = readCache(cacheKey);
  if (cached) { onProgress(100); return cached; }
  const attempts = [
    { url: `/api/osm-forest-paths?areaId=${encodeURIComponent(area.id)}&south=${south}&west=${west}&north=${north}&east=${east}`, timeoutMs: 38_000 },
    { url: `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, timeoutMs: 15_000 },
    { url: `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`, timeoutMs: 15_000 },
  ];
  let payload: OverpassWayResponse | null = null;
  let lastError: unknown = null;
  onProgress(10);
  for (let index = 0; index < attempts.length; index += 1) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const controller = new AbortController();
    const abortAttempt = () => controller.abort();
    signal.addEventListener("abort", abortAttempt, { once: true });
    const timeout = setTimeout(() => controller.abort(), attempts[index].timeoutMs);
    try {
      onProgress(15 + index * 20);
      const response = await fetch(attempts[index].url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      onProgress(55 + index * 12);
      payload = await response.json() as OverpassWayResponse;
      break;
    } catch (error) { lastError = error; }
    finally { clearTimeout(timeout); signal.removeEventListener("abort", abortAttempt); }
  }
  if (!payload) throw lastError instanceof Error ? lastError : new Error("OSM-Wegenetz konnte nicht geladen werden.");
  onProgress(80);
  if (payload.paths?.length) {
    writeCache(cacheKey, payload.paths);
    onProgress(100);
    return payload.paths;
  }
  const paths = (payload.elements ?? []).flatMap<OsmForestPath>((way) => clipWayToPolygon((way.geometry ?? []).map(({ lat, lon }) => ({ lat, lng: lon })), area.polygon).map((coordinates, partIndex) => ({
    id: way.id * 100 + partIndex,
    name: way.tags?.name ?? way.tags?.ref ?? `Waldweg ${way.id}`,
    highway: way.tags?.highway ?? "path",
    coordinates: simplifyPath(coordinates, 1.5),
  })));
  if (paths.length > 0) writeCache(cacheKey, paths);
  onProgress(100);
  return paths;
}

function readCache(cacheKey: string): OsmForestPath[] | null {
  const memory = memoryCache.get(cacheKey);
  if (memory?.length) { writeCache(cacheKey, memory); return memory; }
  try {
    const entry = JSON.parse(browserRuntime.localStorage.getItem(cacheKey) ?? "null") as BrowserCacheEntry | null;
    if (entry?.paths?.length && Date.now() - (entry.cachedAt ?? 0) < cacheMaxAgeMs) { writeCache(cacheKey, entry.paths); return entry.paths; }
  } catch { /* cache is optional */ }
  return null;
}

function writeCache(cacheKey: string, paths: OsmForestPath[]) {
  if (paths.length === 0) return;
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, paths);
  while (memoryCache.size > 3) memoryCache.delete(memoryCache.keys().next().value!);
  try {
    const previous = JSON.parse(browserRuntime.localStorage.getItem(cacheIndexKey) ?? "[]") as string[];
    const next = [cacheKey, ...previous.filter((key) => key !== cacheKey)].slice(0, 3);
    browserRuntime.localStorage.setItem(cacheKey, JSON.stringify({ paths, cachedAt: Date.now() }));
    previous.filter((key) => !next.includes(key)).forEach((key) => browserRuntime.localStorage.removeItem(key));
    browserRuntime.localStorage.setItem(cacheIndexKey, JSON.stringify(next));
  } catch { /* cache is optional */ }
}

export function clipWayToPolygon(coordinates: Coordinate[], polygon: Coordinate[]): Coordinate[][] {
  const parts: Coordinate[][] = [];
  let current: Coordinate[] = [];
  const append = (start: Coordinate, end: Coordinate) => {
    const last = current[current.length - 1];
    if (last && distanceSquared(last, start) > 1e-12) { if (current.length >= 2) parts.push(current); current = []; }
    if (current.length === 0) current.push(start);
    current.push(end);
  };
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const startInside = coordinateInPolygon(start, polygon);
    const endInside = coordinateInPolygon(end, polygon);
    const intersections = polygon.map((edgeStart, edgeIndex) => segmentIntersection(start, end, edgeStart, polygon[(edgeIndex + 1) % polygon.length]))
      .filter((entry): entry is { point: Coordinate; t: number } => entry !== null).sort((a, b) => a.t - b.t)
      .filter((entry, entryIndex, entries) => entryIndex === 0 || distanceSquared(entry.point, entries[entryIndex - 1].point) > 1e-12);
    if (startInside && endInside) append(start, end);
    else if (startInside && intersections.length) append(start, intersections[0].point);
    else if (endInside && intersections.length) append(intersections[intersections.length - 1].point, end);
    else if (intersections.length >= 2) append(intersections[0].point, intersections[intersections.length - 1].point);
    else if (current.length >= 2) { parts.push(current); current = []; }
  }
  if (current.length >= 2) parts.push(current);
  return parts;
}

function segmentIntersection(a: Coordinate, b: Coordinate, c: Coordinate, d: Coordinate): { point: Coordinate; t: number } | null {
  const denominator = (b.lng - a.lng) * (d.lat - c.lat) - (b.lat - a.lat) * (d.lng - c.lng);
  if (Math.abs(denominator) < 1e-14) return null;
  const t = ((c.lng - a.lng) * (d.lat - c.lat) - (c.lat - a.lat) * (d.lng - c.lng)) / denominator;
  const u = ((c.lng - a.lng) * (b.lat - a.lat) - (c.lat - a.lat) * (b.lng - a.lng)) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { point: { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t }, t } : null;
}

function coordinateInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]; const prior = polygon[previous];
    if ((current.lat > point.lat) !== (prior.lat > point.lat) && point.lng < ((prior.lng - current.lng) * (point.lat - current.lat)) / (prior.lat - current.lat) + current.lng) inside = !inside;
  }
  return inside;
}

function coordinateBounds(coordinates: Coordinate[]): [[number, number], [number, number]] | null {
  return coordinates.length ? [[Math.min(...coordinates.map(({ lat }) => lat)), Math.min(...coordinates.map(({ lng }) => lng))], [Math.max(...coordinates.map(({ lat }) => lat)), Math.max(...coordinates.map(({ lng }) => lng))]] : null;
}

function distanceSquared(a: Coordinate, b: Coordinate): number { return (a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2; }

export function simplifyPath(points: Coordinate[], toleranceMeters: number): Coordinate[] {
  if (points.length <= 2) return points;
  const originLat = points[0].lat;
  const cosine = Math.cos((originLat * Math.PI) / 180);
  const projected = points.map((point) => ({ x: point.lng * 111_320 * cosine, y: point.lat * 111_320 }));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const visit = (startIndex: number, endIndex: number) => {
    const start = projected[startIndex];
    const end = projected[endIndex];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    let furthestIndex = -1;
    let furthestDistanceSquared = toleranceMeters * toleranceMeters;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const point = projected[index];
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
      const distance = (point.x - (start.x + t * dx)) ** 2 + (point.y - (start.y + t * dy)) ** 2;
      if (distance > furthestDistanceSquared) { furthestDistanceSquared = distance; furthestIndex = index; }
    }
    if (furthestIndex < 0) return;
    keep[furthestIndex] = 1;
    visit(startIndex, furthestIndex);
    visit(furthestIndex, endIndex);
  };
  visit(0, points.length - 1);
  return points.filter((_, index) => keep[index] === 1);
}
