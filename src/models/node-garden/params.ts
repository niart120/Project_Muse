export interface NodeGardenParams {
  // ── ノード ──
  /** ノード数 (10–200) */
  nodeCount: number;
  /** 球の半径 */
  sphereRadius: number;
  /** 球面からの ε オフセット (0 で厳密に球面上) */
  surfaceEpsilon: number;
  /** 描画ポイントサイズ */
  pointSize: number;

  // ── 運動 ──
  /** 速度倍率 (0 で停止) */
  speedMultiplier: number;
  /** 角速度の下限 (rad/s) */
  angularSpeedMin: number;
  /** 角速度の上限 (rad/s) */
  angularSpeedMax: number;
  /** true のとき全ノードを大円軌道に強制する */
  forceGreatCircle: boolean;

  // ── エッジ ──
  /** エッジ生成の距離閾値 */
  edgeMaxDistance: number;
  /** エッジの不透明度 (0–1) */
  edgeOpacity: number;

  // ── カラー ──
  /** ノード色 (hex) */
  nodeColor: string;
  /** エッジ色 (hex) */
  edgeColor: string;
  /** 背景色 (hex) */
  backgroundColor: string;
}

export const defaultParams: Readonly<NodeGardenParams> = {
  nodeCount: 100,
  sphereRadius: 1.0,
  surfaceEpsilon: 0.02,
  pointSize: 0.05,

  speedMultiplier: 1.0,
  angularSpeedMin: 0.1,
  angularSpeedMax: 0.5,
  forceGreatCircle: false,

  edgeMaxDistance: 0.6,
  edgeOpacity: 0.3,

  nodeColor: "#00BFFF",
  edgeColor: "#00BFFF",
  backgroundColor: "#0A0F1A",
};
