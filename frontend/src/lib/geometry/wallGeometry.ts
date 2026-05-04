import * as THREE from "three";
import type { Wall } from "../../types/garage";

export function buildWallGeometry(walls: Wall[]): THREE.BufferGeometry {
  if (!walls || !Array.isArray(walls)) return new THREE.BufferGeometry();
  const geometries: THREE.BufferGeometry[] = [];

  for (const wall of walls) {
    if (wall.points.length < 2) continue;

    for (let i = 0; i < wall.points.length - 1; i++) {
      const a = wall.points[i];
      const b = wall.points[i + 1];
      const geo = buildWallSegment(a, b, wall.height, wall.thickness);
      geometries.push(geo);
    }
  }

  if (geometries.length === 0) return new THREE.BufferGeometry();
  return mergeGeometries(geometries);
}

function buildWallSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  height: number,
  thickness: number
): THREE.BufferGeometry {
  const dx = b.x - a.x;
  const dz = b.y - a.y;
  const length = Math.sqrt(dx * dx + dz * dz);
  if (length < 0.01) return new THREE.BufferGeometry();

  const geo = new THREE.BoxGeometry(length, height, thickness);

  // Position at midpoint
  const mx = (a.x + b.x) / 2;
  const mz = (a.y + b.y) / 2;
  const angle = Math.atan2(dz, dx);

  const matrix = new THREE.Matrix4();
  matrix.makeRotationY(-angle);
  matrix.setPosition(mx, height / 2, mz);
  geo.applyMatrix4(matrix);

  return geo;
}

function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Manual merge — avoids three/addons dependency
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (const geo of geos) {
    const pos = geo.getAttribute("position");
    const nor = geo.getAttribute("normal");
    const uv = geo.getAttribute("uv");
    const idx = geo.getIndex();

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + indexOffset);
      }
    }

    indexOffset += pos.count;
    geo.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (indices.length) merged.setIndex(indices);

  return merged;
}
