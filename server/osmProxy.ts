export type OsmBounds = [south: number, west: number, north: number, east: number];
import type { Coordinate } from "../src/domain.js";
import { clipWayToPolygon, type OsmForestPath, simplifyPath } from "../src/osmForestPaths.js";

const cache = new Map<string, { payload: unknown; cachedAt: number }>();
const cacheMaxAgeMs = 24 * 60 * 60 * 1_000;
const upstreamEndpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const preparedCache = new Map<string, { paths: OsmForestPath[]; cachedAt: number }>();

interface OverpassPayload { elements?: Array<{ type?: string; id: number; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> }> }

export function parseOsmBounds(query: Record<string, unknown>): OsmBounds {
  const bounds = ["south", "west", "north", "east"].map((key) => Number(query[key])) as OsmBounds;
  if (bounds.some((value) => !Number.isFinite(value))) throw new Error("Invalid OSM bounding box");
  const [south, west, north, east] = bounds;
  if (south >= north || west >= east || north - south > 1 || east - west > 1) throw new Error("OSM bounding box outside allowed size");
  return bounds;
}

export function prepareOsmWays(payload: unknown, polygon: Coordinate[], cacheKey: string, toleranceMeters = 2.5): { paths: OsmForestPath[]; cacheStatus: "HIT" | "MISS" } {
  const cached = preparedCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < cacheMaxAgeMs) return { paths: cached.paths, cacheStatus: "HIT" };
  const paths = ((payload as OverpassPayload).elements ?? []).flatMap<OsmForestPath>((way) => {
    if (way.type !== "way") return [];
    return clipWayToPolygon((way.geometry ?? []).map(({ lat, lon }) => ({ lat, lng: lon })), polygon).map((coordinates, partIndex) => ({
      id: way.id * 100 + partIndex,
      name: way.tags?.name ?? way.tags?.ref ?? `Waldweg ${way.id}`,
      highway: way.tags?.highway ?? "path",
      coordinates: simplifyPath(coordinates, toleranceMeters),
    }));
  }).filter((path) => path.coordinates.length >= 2);
  if (paths.length) {
    preparedCache.set(cacheKey, { paths, cachedAt: Date.now() });
    while (preparedCache.size > 30) preparedCache.delete(preparedCache.keys().next().value!);
  }
  return { paths, cacheStatus: "MISS" };
}

export async function fetchOsmWays(bounds: OsmBounds): Promise<{ payload: unknown; cacheStatus: "HIT" | "MISS" }> {
  const cacheKey = bounds.map((value) => value.toFixed(6)).join(":");
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < cacheMaxAgeMs) return { payload: cached.payload, cacheStatus: "HIT" };
  const [south, west, north, east] = bounds;
  const query = `[out:json][timeout:25];way["highway"~"^(track|path|footway|bridleway|cycleway|service|unclassified)$"](${south},${west},${north},${east});out geom;`;
  let lastError: unknown = null;
  for (const endpoint of upstreamEndpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Project-Athene/0.1 OSM forest path loader" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!upstream.ok) throw new Error(`Overpass upstream ${upstream.status}`);
      const payload = await upstream.json();
      cache.delete(cacheKey);
      cache.set(cacheKey, { payload, cachedAt: Date.now() });
      while (cache.size > 20) cache.delete(cache.keys().next().value!);
      return { payload, cacheStatus: "MISS" };
    } catch (error) { lastError = error; }
    finally { clearTimeout(timeout); }
  }
  throw lastError instanceof Error ? lastError : new Error("OSM path service unavailable");
}
