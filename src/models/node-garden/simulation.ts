import type { NodeGardenParams } from "./params";

/** シミュレーションの全状態 */
export interface NodeState {
  /** 現在位置 [x,y,z] × nodeCount */
  positions: Float32Array;
  /** ノードごとの動径 (sphereRadius × (1 ± ε)) */
  radii: Float32Array;
  /** 回転軸 [ax,ay,az] × nodeCount (単位ベクトル) */
  axes: Float32Array;
  /** 現在の回転角 (rad) */
  angles: Float32Array;
  /** 角速度 (rad/s) */
  angularSpeeds: Float32Array;
  /** 初期位置ベクトル [x,y,z] × nodeCount */
  initialPositions: Float32Array;
  /** ノード数 */
  nodeCount: number;
}

/** エッジ計算の結果 */
export interface EdgeResult {
  /** ノード対 [i,j] × count */
  pairs: Uint32Array;
  /** 各ペアの距離 */
  distances: Float32Array;
  /** エッジ数 */
  count: number;
}

// ── 内部ユーティリティ ──

function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randomPointOnSphere(): [number, number, number] {
  let x: number, y: number, z: number, len: number;
  do {
    x = gaussianRandom();
    y = gaussianRandom();
    z = gaussianRandom();
    len = Math.sqrt(x * x + y * y + z * z);
  } while (len < 1e-8);
  return [x / len, y / len, z / len];
}

function rotateAroundAxis(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  angle: number,
): [number, number, number] {
  const half = angle * 0.5;
  const sinH = Math.sin(half);
  const cosH = Math.cos(half);

  const qw = cosH;
  const qx = sinH * ax;
  const qy = sinH * ay;
  const qz = sinH * az;

  const tx = 2 * (qy * pz - qz * py);
  const ty = 2 * (qz * px - qx * pz);
  const tz = 2 * (qx * py - qy * px);

  return [
    px + qw * tx + (qy * tz - qz * ty),
    py + qw * ty + (qz * tx - qx * tz),
    pz + qw * tz + (qx * ty - qy * tx),
  ];
}

function orthogonalizeToAxis(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
): [number, number, number] {
  const dot = px * ax + py * ay + pz * az;
  let ox = px - dot * ax;
  let oy = py - dot * ay;
  let oz = pz - dot * az;
  let len = Math.sqrt(ox * ox + oy * oy + oz * oz);

  if (len < 1e-8) {
    // 軸と平行: 任意の直交ベクトルを生成
    const absX = Math.abs(ax);
    const absY = Math.abs(ay);
    if (absX < absY) {
      ox = 0;
      oy = -az;
      oz = ay;
    } else {
      ox = az;
      oy = 0;
      oz = -ax;
    }
    len = Math.sqrt(ox * ox + oy * oy + oz * oz);
  }

  return [ox / len, oy / len, oz / len];
}

// ── 公開関数 ──

/** NodeState を生成し、ノードを球面上にランダム配置する */
export function createNodeState(params: NodeGardenParams): NodeState {
  const {
    nodeCount,
    sphereRadius,
    surfaceEpsilon,
    angularSpeedMin,
    angularSpeedMax,
    forceGreatCircle,
  } = params;
  const n = nodeCount;

  const positions = new Float32Array(n * 3);
  const radii = new Float32Array(n);
  const axes = new Float32Array(n * 3);
  const angles = new Float32Array(n);
  const angularSpeeds = new Float32Array(n);
  const initialPositions = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const i3 = i * 3;

    // 動径
    const eps = surfaceEpsilon > 0 ? (Math.random() * 2 - 1) * surfaceEpsilon : 0;
    radii[i] = sphereRadius * (1 + eps);

    // 回転軸
    const [axx, ayy, azz] = randomPointOnSphere();
    axes[i3] = axx;
    axes[i3 + 1] = ayy;
    axes[i3 + 2] = azz;

    // 球面上の初期位置
    let [px, py, pz] = randomPointOnSphere();

    if (forceGreatCircle) {
      [px, py, pz] = orthogonalizeToAxis(px, py, pz, axx, ayy, azz);
    }

    initialPositions[i3] = px * radii[i];
    initialPositions[i3 + 1] = py * radii[i];
    initialPositions[i3 + 2] = pz * radii[i];

    // 初期位置をそのまま現在位置にコピー
    positions[i3] = initialPositions[i3];
    positions[i3 + 1] = initialPositions[i3 + 1];
    positions[i3 + 2] = initialPositions[i3 + 2];

    // 角速度
    angularSpeeds[i] = angularSpeedMin + Math.random() * (angularSpeedMax - angularSpeedMin);

    // 初期回転角
    angles[i] = 0;
  }

  return { positions, radii, axes, angles, angularSpeeds, initialPositions, nodeCount: n };
}

/** 全ノードの位置を回転運動で更新する */
export function updateNodePositions(
  state: NodeState,
  params: NodeGardenParams,
  delta: number,
): void {
  const { speedMultiplier } = params;
  const { nodeCount, axes, angles, angularSpeeds, initialPositions, positions } = state;

  for (let i = 0; i < nodeCount; i++) {
    const i3 = i * 3;
    angles[i] += angularSpeeds[i] * speedMultiplier * delta;

    const [rx, ry, rz] = rotateAroundAxis(
      initialPositions[i3],
      initialPositions[i3 + 1],
      initialPositions[i3 + 2],
      axes[i3],
      axes[i3 + 1],
      axes[i3 + 2],
      angles[i],
    );

    positions[i3] = rx;
    positions[i3 + 1] = ry;
    positions[i3 + 2] = rz;
  }
}

// エッジアルゴリズムは edges/ ディレクトリに移設
export { computeDistanceEdges } from "./edges/distance";
