import type { LngLat } from '../types';

const EARTH_R = 6371000; // meters

export function haversine(a: LngLat, b: LngLat): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

// Straight-line distance matrix, used when the road-time matrix isn't available.
export function haversineMatrix(points: LngLat[]): number[][] {
  return points.map((a) => points.map((b) => haversine(a, b)));
}

export function nearestIndex(p: LngLat, line: LngLat[]) {
  let index = 0;
  let distanceM = Infinity;
  line.forEach((pt, i) => {
    const d = haversine(p, pt);
    if (d < distanceM) {
      distanceM = d;
      index = i;
    }
  });
  return { index, distanceM };
}

/**
 * Finds the best visiting order for an open path.
 * m[0] is the start point; m[i][j] is the cost from point i to point j
 * (travel time in seconds, or distance). Returns indices into the stops
 * array, where index k means m[k + 1].
 * Works with asymmetric costs, which road travel times are.
 */
export function solveOrder(m: number[][]): number[] {
  const n = m.length;
  const left = Array.from({ length: n - 1 }, (_, k) => k + 1);
  const path = [0];
  let cur = 0;

  // Nearest-neighbour starting order
  while (left.length) {
    let bi = 0;
    for (let k = 1; k < left.length; k++) {
      if (m[cur][left[k]] < m[cur][left[bi]]) bi = k;
    }
    cur = left.splice(bi, 1)[0];
    path.push(cur);
  }

  const cost = (p: number[]) => {
    let c = 0;
    for (let k = 0; k < p.length - 1; k++) c += m[p[k]][p[k + 1]];
    return c;
  };

  // 2-opt: reverse segments while the total cost drops. The start stays fixed.
  let best = cost(path);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidate = [
          ...path.slice(0, i),
          ...path.slice(i, j + 1).reverse(),
          ...path.slice(j + 1),
        ];
        const c = cost(candidate);
        if (c < best - 1e-6) {
          path.splice(0, path.length, ...candidate);
          best = c;
          improved = true;
        }
      }
    }
  }

  return path.slice(1).map((k) => k - 1);
}

// Total cost of a path. `path` lists matrix indices in visiting order, starting with 0.
export function pathCost(m: number[][], path: number[]): number {
  let c = 0;
  for (let k = 0; k < path.length - 1; k++) c += m[path[k]][path[k + 1]];
  return c;
}