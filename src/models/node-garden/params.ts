/**
 * Node Garden パラメータ定義。
 * lil-gui にバインドして実行時に操作する。
 */
export interface NodeGardenParams {
  /** ノード数 */
  nodeCount: number;
  /** 各ノードの球半径 */
  nodeRadius: number;
  /** 初期配置の範囲 (立方体の半径) */
  spread: number;

  /** エッジ生成の最大距離 */
  edgeMaxDistance: number;
  /** エッジの不透明度 (0–1) */
  edgeOpacity: number;

  /** ノードの色 (hex) */
  nodeColor: string;
  /** エッジの色 (hex) */
  edgeColor: string;

  /** アニメーション速度倍率 */
  speed: number;
}

export const defaultParams: NodeGardenParams = {
  nodeCount: 120,
  nodeRadius: 0.08,
  spread: 10,
  edgeMaxDistance: 2.5,
  edgeOpacity: 0.4,
  nodeColor: "#4fc3f7",
  edgeColor: "#ffffff",
  speed: 1.0,
};
