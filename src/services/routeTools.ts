import { haversine, nearestIndex } from './geo';
import type { LngLat } from '../types';

// Compass direction from a to b in degrees, 0 = north.
export function bearing(a: LngLat, b: LngLat): number {
  const r = Math.PI / 180;
  const dLng = (b[0] - a[0]) * r;
  const lat1 = a[1] * r;
  const lat2 = b[1] * r;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) / r + 360) % 360;
}

// Smallest difference between two compass angles (0 to 180).
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function pathLength(line: LngLat[]): number {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) total += haversine(line[i], line[i + 1]);
  return total;
}

// Cuts one continuous route into legs at each stop, in order.
export function splitAtStops(geometry: LngLat[], stopCoords: LngLat[]): LngLat[][] {
  const legs: LngLat[][] = [];
  let from = 0;
  for (const stop of stopCoords) {
    const { index } = nearestIndex(stop, geometry.slice(from));
    const cut = from + index;
    legs.push(geometry.slice(from, cut + 1));
    from = cut;
  }
  return legs;
}

// Parts of a new route that are not on the old route. Used for the purple highlight.
// Samples every second point to keep the calculation fast on a phone.
export function changedRuns(newLine: LngLat[], oldLegs: LngLat[][], thresholdM: number): LngLat[][] {
  const old = oldLegs.flat();
  if (!old.length) return [];

  const runs: LngLat[][] = [];
  let current: LngLat[] = [];
  newLine.forEach((p, i) => {
    if (i % 2 !== 0) return;
    const far = nearestIndex(p, old).distanceM > thresholdM;
    if (far) {
      current.push(p);
    } else {
      if (current.length > 1) runs.push(current);
      current = [];
    }
  });
  if (current.length > 1) runs.push(current);
  return runs;
}