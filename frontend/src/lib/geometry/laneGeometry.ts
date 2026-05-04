import * as THREE from "three";
import type { DrivingLane } from "../../types/garage";

export function buildLaneGeometry(lanes: DrivingLane[], elevation: number): THREE.BufferGeometry {
  if (!lanes || !Array.isArray(lanes)) return new THREE.BufferGeometry();
  const geometries: THREE.BufferGeometry[] = [];

  for (const lane of lanes) {
    if (lane.polygon.length < 3) continue;

    const shape = new THREE.Shape();
    shape.moveTo(lane.polygon[0].x, lane.polygon[0].y);
    for (let i = 1; i < lane.polygon.length; i++) {
      shape.lineTo(lane.polygon[i].x, lane.polygon[i].y);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);

    // ShapeGeometry is in XY plane — rotate to XZ (floor plane)
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    // Offset to floor elevation
    geo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, elevation, 0));

    geometries.push(geo);
  }

  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }

  return mergeShapeGeometries(geometries);
}

function mergeShapeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (const geo of geos) {
    geo.computeVertexNormals();
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
