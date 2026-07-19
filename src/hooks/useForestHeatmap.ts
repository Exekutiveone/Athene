import { useEffect, useMemo, useState } from "react";
import type { Coordinate, LayerDefinition, Observation } from "../domain";
import { colorForValue, getLayerValue } from "../generator";
import type { ForestHeatmapImage } from "../forestHeatmap";

const cache = new Map<string, ForestHeatmapImage>();
let requestSequence = 0;

export interface HeatmapDisplayOptions {
  mode: "full" | "confidence";
  maxDistanceMeters: number;
  minConfidence: number;
}

const defaultOptions: HeatmapDisplayOptions = { mode: "full", maxDistanceMeters: 30, minConfidence: 0.45 };

export function useForestHeatmap(observations: Observation[], layer: LayerDefinition, polygon: Coordinate[], enabled = true, options: HeatmapDisplayOptions = defaultOptions) {
  const [image, setImage] = useState<ForestHeatmapImage | null>(null);
  const [loading, setLoading] = useState(false);
  const key = useMemo(() => {
    const valueSignature = observations.map((observation) => `${observation.id}:${getLayerValue(observation, layer.id).toFixed(4)}:${observation.confidence.toFixed(3)}`).join("|");
    const polygonSignature = polygon.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join(";");
    return `${layer.id}:${options.mode}:${options.maxDistanceMeters}:${options.minConfidence}:${valueSignature}:${polygonSignature}`;
  }, [layer.id, observations, options.maxDistanceMeters, options.minConfidence, options.mode, polygon]);
  useEffect(() => {
    if (!enabled || observations.length === 0 || polygon.length < 3) { setImage(null); setLoading(false); return; }
    const cached = cache.get(key);
    if (cached) { setImage(cached); setLoading(false); return; }
    const worker = new Worker(new URL("../workers/forestHeatmap.worker.ts", import.meta.url), { type: "module" });
    const id = ++requestSequence;
    setLoading(true);
    worker.onmessage = (event: MessageEvent<{ id: number; blob?: Blob; bounds?: [[number, number], [number, number]]; error?: string }>) => {
      if (event.data.id !== id || !event.data.blob || !event.data.bounds) return;
      const result = { url: URL.createObjectURL(event.data.blob), bounds: event.data.bounds };
      cache.set(key, result);
      while (cache.size > 12) { const oldest = cache.keys().next().value; if (!oldest) break; const removed = cache.get(oldest); if (removed) URL.revokeObjectURL(removed.url); cache.delete(oldest); }
      setImage(result); setLoading(false); worker.terminate();
    };
    worker.onerror = () => { setLoading(false); worker.terminate(); };
    const lookup = Array.from({ length: 256 }, (_, index) => parseHeatmapColor(colorForValue(layer.min + index / 255 * (layer.max - layer.min), layer)));
    worker.postMessage({ id, polygon, observations: observations.map((observation) => ({ lat: observation.lat, lng: observation.lng, value: normalize(getLayerValue(observation, layer.id), layer), confidence: observation.confidence })), colorLookup: lookup, mode: options.mode, maxDistanceMeters: options.maxDistanceMeters, minConfidence: options.minConfidence });
    return () => worker.terminate();
  }, [enabled, key, layer, observations, options.maxDistanceMeters, options.minConfidence, options.mode, polygon]);
  return { image, loading };
}

function normalize(value: number, layer: LayerDefinition) { return Math.max(0, Math.min(1, (value - layer.min) / Math.max(Number.EPSILON, layer.max - layer.min))); }
export function parseHeatmapColor(color: string): [number, number, number] {
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  return hex ? [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)] : [15, 118, 110];
}
