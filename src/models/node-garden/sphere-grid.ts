import * as THREE from "three";

/**
 * 球体の緯度経度グリッドラインを LineSegments 用ジオメトリとして生成する。
 *
 * @param radius 球の半径
 * @param latitudeStep 緯度線の間隔 (度)
 * @param longitudeStep 経度線の間隔 (度)
 * @param segments 各線の折れ線近似セグメント数
 * @returns LineSegments 用 BufferGeometry
 */
export function createSphereGrid(
  radius: number,
  latitudeStep: number,
  longitudeStep: number,
  segments: number,
): THREE.BufferGeometry {
  const verts: number[] = [];

  // 緯度線 (水平小円): -90+step 〜 90-step の範囲
  for (let lat = -90 + latitudeStep; lat < 90; lat += latitudeStep) {
    const phi = (lat * Math.PI) / 180;
    const r = radius * Math.cos(phi);
    const y = radius * Math.sin(phi);

    for (let s = 0; s < segments; s++) {
      const theta0 = (s / segments) * 2 * Math.PI;
      const theta1 = ((s + 1) / segments) * 2 * Math.PI;

      verts.push(r * Math.cos(theta0), y, r * Math.sin(theta0));
      verts.push(r * Math.cos(theta1), y, r * Math.sin(theta1));
    }
  }

  // 経度線 (垂直大円): 0 〜 360-step
  for (let lon = 0; lon < 360; lon += longitudeStep) {
    const theta = (lon * Math.PI) / 180;

    for (let s = 0; s < segments; s++) {
      const phi0 = (s / segments) * Math.PI - Math.PI / 2;
      const phi1 = ((s + 1) / segments) * Math.PI - Math.PI / 2;

      const r0 = radius * Math.cos(phi0);
      const r1 = radius * Math.cos(phi1);

      verts.push(r0 * Math.cos(theta), radius * Math.sin(phi0), r0 * Math.sin(theta));
      verts.push(r1 * Math.cos(theta), radius * Math.sin(phi1), r1 * Math.sin(theta));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

/**
 * 球体グリッドの頂点数を計算する (テスト用純粋関数)。
 */
export function computeSphereGridVertexCount(
  latitudeStep: number,
  longitudeStep: number,
  segments: number,
): number {
  // 緯度線の本数
  let count = 0;
  for (let lat = -90 + latitudeStep; lat < 90; lat += latitudeStep) {
    count++;
  }
  const latCount = count;

  // 経度線の本数: 0, step, 2*step, ..., 360-step 未満
  count = 0;
  for (let lon = 0; lon < 360; lon += longitudeStep) {
    count++;
  }
  const lonCount = count;

  // 各線は segments 本のセグメント × 2頂点 (LineSegments)
  return (latCount + lonCount) * segments * 2;
}
