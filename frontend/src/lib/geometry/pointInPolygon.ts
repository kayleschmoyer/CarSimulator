import type { Vector2 } from "../../types/garage";

/** Ray-casting algorithm for point-in-polygon test. */
export function pointInPolygon(point: { x: number; z: number }, polygon: Vector2[]): boolean {
  let inside = false;
  const n = polygon.length;
  let j = n - 1;

  for (let i = 0; i < n; i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y; // y in 2D map = z in 3D
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.z !== yj > point.z &&
      point.x < ((xj - xi) * (point.z - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
    j = i;
  }

  return inside;
}
