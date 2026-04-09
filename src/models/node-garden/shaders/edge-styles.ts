import * as THREE from "three";
import type { EdgeStyle, NodeGardenParams } from "../params";
import type { EdgeResult } from "../simulation";

/**
 * 距離フェードの alpha を計算する (純粋関数)。
 * 距離 0 → 1.0, 距離 = max → 0.0 (二次減衰)。
 */
export function distanceFadeAlpha(distance: number, maxDistance: number): number {
  if (maxDistance <= 0) return 1.0;
  const t = Math.min(distance / maxDistance, 1.0);
  return 1.0 - t * t;
}

/**
 * distance-fade スタイル: 頂点カラーの alpha でエッジごとに不透明度を変える。
 * vertexColors=true のマテリアルと組み合わせて使用する。
 */
export function applyDistanceFadeColors(
  lineGeo: THREE.BufferGeometry,
  edgeResult: EdgeResult,
  params: NodeGardenParams,
): void {
  const { count, distances } = edgeResult;
  const vertCount = lineGeo.getAttribute("position") ? lineGeo.getAttribute("position").count : 0;
  if (vertCount === 0) return;

  const colors = new Float32Array(vertCount * 4);
  const color = new THREE.Color(params.edgeColor);

  for (let e = 0; e < count; e++) {
    const alpha = distanceFadeAlpha(distances[e], params.edgeMaxDistance);
    const o = e * 2; // 直線モードでは 2 頂点/エッジ

    if (o * 4 + 7 < colors.length) {
      colors[o * 4] = color.r;
      colors[o * 4 + 1] = color.g;
      colors[o * 4 + 2] = color.b;
      colors[o * 4 + 3] = alpha * params.edgeOpacity;

      colors[(o + 1) * 4] = color.r;
      colors[(o + 1) * 4 + 1] = color.g;
      colors[(o + 1) * 4 + 2] = color.b;
      colors[(o + 1) * 4 + 3] = alpha * params.edgeOpacity;
    }
  }

  lineGeo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
}

/**
 * breathing スタイル: 全エッジの不透明度を正弦波で変調する。
 */
export function computeBreathingOpacity(baseOpacity: number, time: number, speed: number): number {
  return baseOpacity * (0.5 + 0.5 * Math.sin(time * speed));
}

/**
 * エッジスタイルに応じたマテリアル設定を適用する。
 */
export function configureEdgeMaterial(lineMat: THREE.LineBasicMaterial, style: EdgeStyle): void {
  // distance-fade では vertexColors を有効にする
  lineMat.vertexColors = style === "distance-fade";
}
