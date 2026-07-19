import type { MissionPath, Waypoint } from "./domain.js";

export function splitWaypointsIntoSegments(waypoints: Waypoint[]): Waypoint[][] {
  return waypoints.reduce<Waypoint[][]>((segments, waypoint) => {
    if (segments.length === 0 || waypoint.breakBefore) segments.push([]);
    const { breakBefore: _breakBefore, ...point } = waypoint;
    segments[segments.length - 1].push(point);
    return segments;
  }, []).filter((segment) => segment.length >= 2);
}

export function flattenRouteSegments(segments: Waypoint[][]): Waypoint[] {
  return segments.flatMap((segment, segmentIndex) => segment.map((waypoint, pointIndex) => ({
    ...waypoint,
    ...(segmentIndex > 0 && pointIndex === 0 ? { breakBefore: true } : {}),
  })));
}

export function missionPathSegments(path: MissionPath | null | undefined): Waypoint[][] {
  if (!path) return [];
  const segments = path.segments?.filter((segment) => segment.length >= 2) ?? [];
  return segments.length > 0 ? segments : splitWaypointsIntoSegments(path.waypoints);
}

export function missionPathWaypointsFlat(path: MissionPath | null | undefined): Waypoint[] {
  return flattenRouteSegments(missionPathSegments(path));
}

export function createMissionPath(name: string, waypoints: Waypoint[]): MissionPath {
  const segments = splitWaypointsIntoSegments(waypoints);
  return { name, segments, waypoints: flattenRouteSegments(segments) };
}
