# Phase 1: 球面ノード基盤 + 基本描画 仕様書

## 1. 概要

### 1.1 目的

Node Garden のシミュレーション基盤を立方体内ランダム分布から球面配置 + 回転運動に全面刷新し、HUD テーマの基本カラーで描画できる状態にする。後続フェーズ（エッジアルゴリズム・ビジュアル仕上げ）の土台となる。

### 1.2 用語定義

| 用語         | 定義                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 単位球       | 原点中心・半径 1 の球                                                |
| ε オフセット | 球面からの微小距離ずらし。ノードの動径を `1 ± ε` とする              |
| 回転軸       | ノードの公転軸。原点を通る単位ベクトル                               |
| 軌道傾斜角   | ノードの初期位置ベクトルと回転軸のなす角。90° で大円、それ以外で小円 |
| `NodeState`  | シミュレーションの全状態を保持する構造体（TypedArray 群）            |

### 1.3 背景・問題

現行実装は立方体内のランダム配置 + 直線運動 + 壁反射という単純なモデルで、ビジュアルテーマもない。球面幾何への移行は Phase 2 以降のエッジアルゴリズム（ドロネー、Gabriel 等）の前提条件となる。

### 1.4 期待効果

| 指標         | 現状                            | 目標                                  |
| ------------ | ------------------------------- | ------------------------------------- |
| ノード配置   | 立方体内ランダム                | 単位球面上（± ε）                     |
| 運動モデル   | 直線 + 壁反射                   | 球面上回転（大円 / 小円の自然な混在） |
| 描画方式     | `InstancedMesh`（球体メッシュ） | `Points` + `PointsMaterial`           |
| 背景色       | Three.js デフォルト（黒/透明）  | `#0A0F1A`                             |
| メインカラー | `#4fc3f7`                       | `#00BFFF`                             |

### 1.5 着手条件

- [x] 現行実装の全ファイル把握
- [x] 仕様ヒアリング完了
- [x] 総合仕様書の Phase 分割確定

## 2. 対象ファイル

| ファイル                                      | 変更種別 | 変更内容                                                           |
| --------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `src/models/node-garden/params.ts`            | 修正     | パラメータ全面刷新（球面・運動・HUD カラー）                       |
| `src/models/node-garden/simulation.ts`        | 修正     | class → 関数型に移行。球面配置・回転運動・エッジ計算を全面書き換え |
| `src/models/node-garden/index.ts`             | 修正     | InstancedMesh → Points、背景色・カラー・GUI を HUD テーマに変更    |
| `src/models/node-garden/mod.ts`               | 修正     | export 調整（class 廃止に伴う）                                    |
| `src/core/renderer.ts`                        | 修正     | デフォルトライティング調整（Points 向け）                          |
| `tests/models/node-garden/params.test.ts`     | 修正     | 新パラメータ定義に対応                                             |
| `tests/models/node-garden/simulation.test.ts` | 修正     | 球面配置・回転運動のテストに全面書き換え                           |

## 3. 設計方針

### 3.1 ノード配置

球面上に一様分布させる。球面座標 `(θ, φ)` からの直接サンプリングは極付近に偏るため、以下のいずれかを使用する。

- **正規分布ベクトル正規化**: 3 成分を標準正規分布で生成し、正規化
- **Marsaglia 法**: 単位球面上の一様分布を直接生成

各ノードの動径は `sphereRadius * (1 + uniform(-ε, +ε))` とし、ε = 0 のとき厳密に球面上になる。

### 3.2 運動モデル

各ノードに以下を割り当てる。

1. **回転軸**: ランダムな単位ベクトル（原点を通る）
2. **角速度**: `[angularSpeedMin, angularSpeedMax]` 範囲からランダム
3. **初期位置**: 配置時の球面上の点

更新処理: クォータニオン回転で初期位置ベクトルを回転軸周りに `ω × t` 回す。

```
angles[i] += angularSpeeds[i] * speedMultiplier * delta
q = quaternionFromAxisAngle(axes[i], angles[i])
positions[i] = applyQuaternion(q, initialPositions[i])
```

回転軸と初期位置の角度関係により、大円・小円が自然に混在する。

- 回転軸 ⊥ 初期位置 → 大円軌道
- 回転軸と初期位置が斜め → 小円軌道（緯度線状）
- 回転軸 ∥ 初期位置 → 静止（極点）

制御パラメータで「大円のみモード」を用意する（初期位置を回転軸の直交成分に射影）。

### 3.3 エッジ計算

Phase 1 では距離閾値ベースのみ。ユークリッド距離を使用する。半径 1 の球面上ではユークリッド距離と弦距離が一致し、測地線距離との対応も単調なので、閾値判定に支障はない。

計算量: ノード数 N に対して O(N²)。N ≤ 100 なので全ペア走査で問題ない（最大 4,950 ペア）。

### 3.4 描画

| 要素   | Three.js 構成                                    | 備考                         |
| ------ | ------------------------------------------------ | ---------------------------- |
| ノード | `THREE.Points` + `THREE.PointsMaterial`          | 色 `#00BFFF`、サイズ調整可能 |
| エッジ | `THREE.LineSegments` + `THREE.LineBasicMaterial` | 色 `#00BFFF`、低不透明度     |
| 背景   | `scene.background = new THREE.Color('#0A0F1A')`  | テーマ側で設定               |

`InstancedMesh` + `SphereGeometry` は廃止する。Phase 3 でカスタムシェーダに置き換えるため、Phase 1 は `PointsMaterial` で十分。

### 3.5 core 層の変更

`core/renderer.ts` の現行ライティング（`AmbientLight` + `DirectionalLight`）は `MeshStandardMaterial` 向けの構成。`PointsMaterial` はライティングの影響を受けないため、以下を調整する。

- `AmbientLight` の強度を下げる（将来メッシュ追加時に備え削除はしない）
- `DirectionalLight` の強度を下げる
- テーマ側で `scene.background` を設定する設計とし、core は背景を設定しない

## 4. 実装仕様

### 4.1 params.ts

```typescript
export interface NodeGardenParams {
  // ── ノード ──
  /** ノード数 (10–100) */
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
  nodeCount: 60,
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
```

### 4.2 simulation.ts — 型定義

```typescript
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
```

### 4.3 simulation.ts — 公開関数

```typescript
/** NodeState を生成し、ノードを球面上にランダム配置する */
export function createNodeState(params: NodeGardenParams): NodeState;

/** 全ノードの位置を回転運動で更新する */
export function updateNodePositions(
  state: NodeState,
  params: NodeGardenParams,
  delta: number,
): void;

/** 距離閾値以内のノード対を返す */
export function computeDistanceEdges(state: NodeState, maxDistance: number): EdgeResult;
```

### 4.4 simulation.ts — 配置アルゴリズム

```typescript
// 球面一様分布 (正規分布ベクトル正規化)
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

// Box-Muller 変換
function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
```

### 4.5 simulation.ts — 回転更新

```typescript
// クォータニオン回転で位置を更新
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

  // クォータニオン q = (cosH, sinH*ax, sinH*ay, sinH*az)
  const qw = cosH;
  const qx = sinH * ax;
  const qy = sinH * ay;
  const qz = sinH * az;

  // q * p * q^(-1) を展開
  const tx = 2 * (qy * pz - qz * py);
  const ty = 2 * (qz * px - qx * pz);
  const tz = 2 * (qx * py - qy * px);

  return [
    px + qw * tx + (qy * tz - qz * ty),
    py + qw * ty + (qz * tx - qx * tz),
    pz + qw * tz + (qx * ty - qy * tx),
  ];
}
```

### 4.6 forceGreatCircle の実装

`forceGreatCircle = true` のとき、初期位置ベクトルを回転軸の直交成分に射影する。

```typescript
// 回転軸 a に対して点 p の直交成分を取り、正規化してから radii を掛ける
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
  const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
  if (len < 1e-8) {
    // 軸と平行な場合: 任意の直交ベクトルを生成
    // (実装時に適切な fallback を入れる)
  }
  ox /= len;
  oy /= len;
  oz /= len;
  return [ox, oy, oz];
}
```

### 4.7 index.ts — 描画構成（概要）

```typescript
export function setup(ctx: RendererContext): { update(delta: number): void; dispose(): void } {
  const params: NodeGardenParams = { ...defaultParams };
  let state = createNodeState(params);

  // 背景
  ctx.scene.background = new THREE.Color(params.backgroundColor);

  // ノード (Points)
  const pointsGeo = new THREE.BufferGeometry();
  const pointsMat = new THREE.PointsMaterial({
    color: params.nodeColor,
    size: params.pointSize,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(pointsGeo, pointsMat);
  ctx.scene.add(points);

  // エッジ (LineSegments)
  const lineGeo = new THREE.BufferGeometry();
  const lineMat = new THREE.LineBasicMaterial({
    color: params.edgeColor,
    transparent: true,
    opacity: params.edgeOpacity,
  });
  const edges = new THREE.LineSegments(lineGeo, lineMat);
  ctx.scene.add(edges);

  // ... GUI 構築、update/dispose 関数 ...
}
```

### 4.8 mod.ts

```typescript
export { setup } from "./index";
export type { NodeGardenParams } from "./params";
export { defaultParams } from "./params";
export type { NodeState, EdgeResult } from "./simulation";
export { createNodeState, updateNodePositions, computeDistanceEdges } from "./simulation";
```

## 5. テスト方針

### ユニットテスト

| テスト対象             | 検証内容                    | 入力例                  | 期待結果                                    |
| ---------------------- | --------------------------- | ----------------------- | ------------------------------------------- |
| `createNodeState`      | 配列サイズが正しい          | `nodeCount=50`          | `positions.length === 150`                  |
| `createNodeState`      | ε=0 で全ノードが球面上      | `nodeCount=100, ε=0`    | 各ノードの原点距離が `sphereRadius`         |
| `createNodeState`      | ε>0 で球面近傍              | `nodeCount=100, ε=0.05` | 原点距離が `[0.95, 1.05]` 範囲内            |
| `createNodeState`      | 回転軸が単位ベクトル        | `nodeCount=50`          | 各軸の長さが 1.0                            |
| `createNodeState`      | 角速度が範囲内              | `min=0.1, max=0.5`      | 全ノードが `[0.1, 0.5]` 範囲内              |
| `updateNodePositions`  | 回転後も球面上を維持        | 100 ステップ更新        | 原点距離が `radii[i]` と一致（許容差 1e-6） |
| `updateNodePositions`  | `speedMultiplier=0` で静止  | 10 ステップ更新         | 位置不変                                    |
| `updateNodePositions`  | `forceGreatCircle` 時の軌道 | 全ノード                | 回転軸との内積が 0（許容差 1e-6）           |
| `computeDistanceEdges` | 近接ノード検出              | 2 点距離 0.5、閾値 1.0  | `count === 1`                               |
| `computeDistanceEdges` | 遠方ノード非検出            | 2 点距離 2.0、閾値 0.5  | `count === 0`                               |
| `defaultParams`        | 正値・有効 hex              | —                       | 各フィールドが妥当な値                      |

### 統合テスト

Phase 1 では統合テストは設けない（描画コードはカバレッジ対象外のため）。

## 6. 実装チェックリスト

- [ ] `params.ts` 全面刷新
- [ ] `simulation.ts` 全面書き換え（class → 関数型）
  - [ ] `createNodeState` 実装
  - [ ] `updateNodePositions` 実装
  - [ ] `computeDistanceEdges` 実装
  - [ ] `forceGreatCircle` オプション実装
- [ ] `index.ts` 描画コード更新（`Points` + `LineSegments`）
- [ ] `mod.ts` export 調整
- [ ] `core/renderer.ts` ライティング調整
- [ ] `params.test.ts` 更新
- [ ] `simulation.test.ts` 全面書き換え
- [ ] テスト実行・全パス確認
- [ ] レビュー完了
