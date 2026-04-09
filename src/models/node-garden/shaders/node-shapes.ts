import { Fn, float, uniform, vec4, abs, min, smoothstep, exp, length, select, uv } from "three/tsl";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import { SpriteNodeMaterial, type InstancedBufferAttribute } from "three/webgpu";
import { instancedBufferAttribute } from "three/tsl";
import type { NodeShape } from "../params";

const shapeIndexMap: Record<NodeShape, number> = {
  circle: 0,
  cross: 1,
  diamond: 2,
  hexagon: 3,
};

export { shapeIndexMap };

/** SDF: 円 */
const sdfCircle = Fn(([coord_immutable]: [ReturnType<typeof uv>]) => {
  const coord = coord_immutable.toVar();
  return length(coord).sub(0.5);
});

/** SDF: 十字 */
const sdfCross = Fn(([coord_immutable]: [ReturnType<typeof uv>]) => {
  const coord = coord_immutable.toVar();
  const thickness = float(0.12);
  return min(abs(coord.x), abs(coord.y)).sub(thickness);
});

/** SDF: 菱形 */
const sdfDiamond = Fn(([coord_immutable]: [ReturnType<typeof uv>]) => {
  const coord = coord_immutable.toVar();
  return abs(coord.x).add(abs(coord.y)).sub(0.5);
});

/** SDF: 六角形 */
const sdfHexagon = Fn(([coord_immutable]: [ReturnType<typeof uv>]) => {
  const coord = coord_immutable.toVar();
  const ax = abs(coord.x);
  const ay = abs(coord.y);
  // hexagonal distance: max(ax, ax*0.5 + ay*sqrt(3)/2)
  return ax.mul(0.5).add(ay.mul(0.8660254)).max(ax).sub(0.48);
});

/**
 * SpriteNodeMaterial を生成し、SDF ベースの HUD ノード形状を描画する。
 * shapeUniform で形状を切り替え可能。
 */
export function createNodeShapeMaterial(
  color: string,
  glowIntensity: number,
): {
  material: SpriteNodeMaterial;
  shapeUniform: UniformNode<"float", number>;
  glowUniform: UniformNode<"float", number>;
  setPositions: (attr: InstancedBufferAttribute) => void;
} {
  const shapeUniform = uniform(0);
  const glowUniform = uniform(glowIntensity);
  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;

  // positionNode は後から setPositions で設定
  let positionNodeSet = false;

  const colorNode = Fn(() => {
    // uv: 0..1 → -1..1 の座標系に変換
    const coord = uv().sub(0.5).mul(2.0);

    // 各 SDF の距離
    const dCircle = sdfCircle(coord);
    const dCross = sdfCross(coord);
    const dDiamond = sdfDiamond(coord);
    const dHex = sdfHexagon(coord);

    // shapeUniform で選択
    const dist = select(
      shapeUniform.lessThan(0.5),
      dCircle,
      select(
        shapeUniform.lessThan(1.5),
        dCross,
        select(shapeUniform.lessThan(2.5), dDiamond, dHex),
      ),
    );

    // アンチエイリアスされたエッジ
    const edgeAlpha = smoothstep(float(0.02), float(-0.02), dist);

    // グロー: 外縁から減衰する光彩
    const glowAlpha = exp(dist.negate().mul(4.0)).mul(glowUniform);

    const totalAlpha = edgeAlpha.add(glowAlpha).clamp(0, 1);

    return vec4(1.0, 1.0, 1.0, totalAlpha);
  });

  material.colorNode = colorNode();

  return {
    material,
    shapeUniform,
    glowUniform,
    setPositions(attr: InstancedBufferAttribute) {
      if (!positionNodeSet) {
        material.positionNode = instancedBufferAttribute(attr);
        positionNodeSet = true;
      }
    },
  };
}
