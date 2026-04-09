/** エッジ計算アルゴリズム名 */
export type EdgeAlgorithm = "distance" | "knn" | "mst" | "gabriel";

/** エッジ経路の描画方式 */
export type EdgePathMode = "straight" | "geodesic";

/** ノード形状 */
export type NodeShape = "circle" | "cross" | "diamond" | "hexagon";

/** エッジ描画スタイル */
export type EdgeStyle = "solid" | "distance-fade" | "pulse" | "signal" | "breathing";

/** ベース球体の表示モード */
export type SphereBaseMode = "translucent" | "opaque" | "none";

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
  /** エッジ計算アルゴリズム */
  edgeAlgorithm: EdgeAlgorithm;
  /** エッジ生成の距離閾値 */
  edgeMaxDistance: number;
  /** k-NN の接続数 */
  knnK: number;
  /** エッジ経路の描画方式 */
  edgePathMode: EdgePathMode;
  /** 測地線弧の分割数 */
  geodesicSegments: number;
  /** エッジの不透明度 (0–1) */
  edgeOpacity: number;

  // ── ビジュアル (Phase 3) ──
  /** ノード形状 */
  nodeShape: NodeShape;
  /** ノードのグロー強度 (0 で無効) */
  nodeGlowIntensity: number;

  /** エッジ描画スタイル */
  edgeStyle: EdgeStyle;
  /** パルス速度 */
  pulseSpeed: number;
  /** パルス幅 (0–1) */
  pulseWidth: number;
  /** シグナルパケット速度 */
  signalSpeed: number;
  /** ブリージング速度 */
  breathingSpeed: number;

  /** ブルーム有効 */
  bloomEnabled: boolean;
  /** ブルーム強度 */
  bloomStrength: number;
  /** ブルーム半径 */
  bloomRadius: number;
  /** ブルーム閾値 */
  bloomThreshold: number;

  /** ベース球体の表示モード */
  sphereBaseMode: SphereBaseMode;
  /** ベース球体の半径比率 (sphereRadius に対する比率, 0.9–1.0) */
  sphereBaseRadiusRatio: number;
  /** ベース球体の色 (hex) */
  sphereBaseColor: string;

  /** 球体グリッド表示 */
  sphereGridVisible: boolean;
  /** 球体グリッドの色 (hex) */
  sphereGridColor: string;
  /** 球体グリッドの不透明度 */
  sphereGridOpacity: number;

  // ── カラー ──
  /** ノード色 (hex) */
  nodeColor: string;
  /** エッジ色 (hex) */
  edgeColor: string;
  /** 背景色 (hex) */
  backgroundColor: string;
}

/** カラープリセット名 */
export type ColorPreset = "hud-cyan" | "emerald" | "amber" | "frost" | "infrared";

/** カラープリセットが定義する色群 */
export interface ColorPresetColors {
  nodeColor: string;
  edgeColor: string;
  sphereGridColor: string;
  sphereBaseColor: string;
  backgroundColor: string;
}

export const colorPresets: Readonly<Record<ColorPreset, ColorPresetColors>> = {
  /** デフォルト: ミリタリー HUD シアン */
  "hud-cyan": {
    nodeColor: "#00BFFF",
    edgeColor: "#00BFFF",
    sphereGridColor: "#00BFFF",
    sphereBaseColor: "#050810",
    backgroundColor: "#0D1117",
  },
  /** エメラルドグリーン */
  emerald: {
    nodeColor: "#00FF87",
    edgeColor: "#00FF87",
    sphereGridColor: "#00FF87",
    sphereBaseColor: "#040D08",
    backgroundColor: "#0A1510",
  },
  /** 琥珀色の警告トーン */
  amber: {
    nodeColor: "#FFB000",
    edgeColor: "#FFB000",
    sphereGridColor: "#FFB000",
    sphereBaseColor: "#100A02",
    backgroundColor: "#15100A",
  },
  /** 冷青白のレーダートーン */
  frost: {
    nodeColor: "#B0E0FF",
    edgeColor: "#8EC8F0",
    sphereGridColor: "#8EC8F0",
    sphereBaseColor: "#060A10",
    backgroundColor: "#0A0F18",
  },
  /** 赤外線イメージ */
  infrared: {
    nodeColor: "#FF3333",
    edgeColor: "#FF3333",
    sphereGridColor: "#FF3333",
    sphereBaseColor: "#100404",
    backgroundColor: "#150A0A",
  },
};

export const defaultParams: Readonly<NodeGardenParams> = {
  nodeCount: 100,
  sphereRadius: 1.0,
  surfaceEpsilon: 0.02,
  pointSize: 0.05,

  speedMultiplier: 1.0,
  angularSpeedMin: 0.1,
  angularSpeedMax: 0.5,
  forceGreatCircle: false,

  edgeAlgorithm: "distance",
  edgeMaxDistance: 0.6,
  knnK: 5,
  edgePathMode: "straight",
  geodesicSegments: 12,
  edgeOpacity: 0.3,

  nodeShape: "circle",
  nodeGlowIntensity: 0.3,

  edgeStyle: "solid",
  pulseSpeed: 1.0,
  pulseWidth: 0.15,
  signalSpeed: 0.8,
  breathingSpeed: 0.5,

  bloomEnabled: true,
  bloomStrength: 0.6,
  bloomRadius: 0.3,
  bloomThreshold: 0.1,

  sphereBaseMode: "translucent",
  sphereBaseRadiusRatio: 0.95,
  sphereBaseColor: "#050810",

  sphereGridVisible: true,
  sphereGridColor: "#00BFFF",
  sphereGridOpacity: 0.06,

  nodeColor: "#00BFFF",
  edgeColor: "#00BFFF",
  backgroundColor: "#0D1117",
};
