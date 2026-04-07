# Phase 2: エッジアルゴリズム 仕様書

## 1. 概要

### 1.1 目的

Phase 1 の距離閾値エッジに加え、k-NN・MST・Gabriel グラフの 3 アルゴリズムを実装し、GUI から切り替えられるようにする。エッジの描画経路として直線と測地線弧を選択可能にする。

> **断念事項**: 球面ドロネー三角形分割 (Delaunay) は当初 5 種目のアルゴリズムとして計画していたが、ノードが毎フレーム移動する硲境ではトポロジの切替わりによるエッジのチラつきが不可避であり、描画品質の要件を満たせないため実装を断念した。インクリメンタル凸包法およびギフトラッピング法の両方を試したが、アルゴリズムの安定性ではなく、ドロネー分割自体がノード位置に敏感に反応する性質が問題。ヒステリシスによる軽減も検討したが、応答性の低下と引き換えになるため採用しなかった。

### 1.2 用語定義

| 用語           | 定義                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| k-NN           | k-Nearest Neighbors。各ノードの最近傍 k 個と接続する                             |
| 球面ドロネー   | 球面上の点群に対する Delaunay 三角形分割。凸包の双対として計算可能               |
| MST            | Minimum Spanning Tree。全ノードを最小コストで連結する木                          |
| Gabriel グラフ | 辺 (i, j) の直径球内に他の点が存在しないとき接続するグラフ。ドロネーの部分グラフ |
| 弦距離         | 3D 空間でのユークリッド距離。球面上の 2 点間の直線距離                           |
| 測地線距離     | 球面上の最短経路（大円弧）の長さ。`2 * arcsin(chord / 2)` で弦距離から算出       |
| 平面グラフ     | 球面射影でエッジが交差しない（球面であれば位相的に平面に埋め込みできる）グラフ   |
| エッジ戦略     | エッジ計算を行う関数のシグネチャ。アルゴリズム切替の単位                         |

### 1.3 背景・問題

Phase 1 の距離閾値方式はノード密度の偏りに弱い。密集領域ではエッジ過多、疎な領域ではエッジがなくなる。構造的なグラフアルゴリズムを複数用意することで、密度に依存しない接続パターンを実現する。

### 1.4 期待効果

| 指標                     | 現状 (Phase 1 完了時) | 目標                             |
| ------------------------ | --------------------- | -------------------------------- |
| エッジアルゴリズム数     | 1（距離閾値）         | 4（距離, k-NN, MST, Gabriel）    |
| エッジ経路描画           | 直線のみ              | 直線 / 測地線弧の切替            |
| GUI 切替                 | なし                  | ドロップダウンでアルゴリズム選択 |
| 100 ノード時のエッジ計算 | < 1 ms （距離閾値）   | < 50 ms                          |

### 1.5 着手条件

- [x] Phase 1 の実装・テスト完了
- [x] `NodeState` / `EdgeResult` 型が安定している

## 2. 対象ファイル

| ファイル                                      | 変更種別 | 変更内容                                                                 |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `src/models/node-garden/simulation.ts`        | 修正     | エッジ戦略パターン導入、4 アルゴリズム追加                               |
| `src/models/node-garden/edges/`               | 新規     | アルゴリズムごとのモジュール分割（任意。simulation.ts が肥大化する場合） |
| `src/models/node-garden/params.ts`            | 修正     | エッジ関連パラメータ追加                                                 |
| `src/models/node-garden/index.ts`             | 修正     | GUI にアルゴリズム切替追加、測地線弧描画対応                             |
| `src/models/node-garden/mod.ts`               | 修正     | 新規 export 追加                                                         |
| `tests/models/node-garden/simulation.test.ts` | 修正     | 各アルゴリズムのテスト追加                                               |

## 3. 設計方針

### 3.1 エッジ戦略パターン

アルゴリズムの切替を関数の差し替えで実現する。全アルゴリズムが同一シグネチャに従う。

```typescript
/** エッジ計算関数のシグネチャ */
export type EdgeStrategy = (state: NodeState, params: NodeGardenParams) => EdgeResult;
```

アルゴリズム名と関数を対応付けるマップを用意する。

```typescript
export type EdgeAlgorithm = "distance" | "knn" | "mst" | "gabriel";

export const edgeStrategies: Record<EdgeAlgorithm, EdgeStrategy> = {
  distance: computeDistanceEdges,
  knn: computeKnnEdges,
  mst: computeMstEdges,
  gabriel: computeGabrielEdges,
};
```

`index.ts` から呼び出す際:

```typescript
const strategy = edgeStrategies[params.edgeAlgorithm];
const edges = strategy(state, params);
```

### 3.2 各アルゴリズムの設計

#### 距離閾値（Phase 1 から移行）

Phase 1 の `computeDistanceEdges` をそのまま `EdgeStrategy` シグネチャに適合させる。

- パラメータ: `edgeMaxDistance`
- 計算量: O(N²)
- 平面グラフ保証: なし

#### k-最近傍 (k-NN)

各ノードに対して弦距離が近い順に k 個のノードを選び、接続する。

- パラメータ: `knnK`（接続数 k）
- 注意: k-NN は対称とは限らない（A が B の k-NN でも、B が A の k-NN とは限らない）。エッジは和集合（どちらかが選べば接続）にする
- 計算量: O(N² log k)（全ペア距離を計算し、各ノードで k 個を選択）
- 平面グラフ保証: なし

```typescript
export function computeKnnEdges(state: NodeState, params: NodeGardenParams): EdgeResult;
```

#### 球面ドロネー三角形分割 — 断念

> 実装を断念。ノードが毎フレーム移動する硲境ではトポロジの切替わりによるエッジのチラつきが不可避であり、描画品質の要件を満たせなかった。インクリメンタル凸包法・ギフトラッピング法の両方を試行したが、アルゴリズムの安定性ではなくドロネー分割自体の位置敏感性が問題。ヒステリシスによる軽減も検討したが応答性低下とのトレードオフにより不採用。

#### 最小全域木 (MST)

全ペアの弦距離を辺コストとして Kruskal 法で MST を構築する。

- パラメータ: なし
- 計算量: O(N² log N)（全ペア距離ソート + Union-Find）
- 平面グラフ保証: あり（木は常に平面グラフ）
- 特性: エッジ数 = N - 1。疎だが全連結

```typescript
export function computeMstEdges(state: NodeState, params: NodeGardenParams): EdgeResult;
```

Union-Find の実装:

```typescript
function createUnionFind(n: number): {
  find(x: number): number;
  union(x: number, y: number): boolean;
} {
  const parent = new Int32Array(n);
  const rank = new Uint8Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression
      x = parent[x];
    }
    return x;
  }

  function union(x: number, y: number): boolean {
    const rx = find(x);
    const ry = find(y);
    if (rx === ry) return false;
    if (rank[rx] < rank[ry]) {
      parent[rx] = ry;
    } else if (rank[rx] > rank[ry]) {
      parent[ry] = rx;
    } else {
      parent[ry] = rx;
      rank[rx]++;
    }
    return true;
  }

  return { find, union };
}
```

#### Gabriel グラフ

辺 (i, j) の中点を中心、`distance(i, j) / 2` を半径とする球内に他のノードが存在しなければ接続する。

- パラメータ: なし
- 計算量: O(N³)（全ペア × 全ノード判定）。N ≤ 100 では最大 100³ = 10⁶ 演算。許容範囲
- 平面グラフ保証: あり（Gabriel グラフはドロネーの部分グラフ）
- 特性: ドロネーより疎。MST を含む

```typescript
export function computeGabrielEdges(state: NodeState, params: NodeGardenParams): EdgeResult;
```

判定ロジック:

```typescript
// (i, j) が Gabriel エッジかどうか
function isGabrielEdge(positions: Float32Array, i: number, j: number, n: number): boolean {
  const i3 = i * 3;
  const j3 = j * 3;
  // 中点
  const mx = (positions[i3] + positions[j3]) * 0.5;
  const my = (positions[i3 + 1] + positions[j3 + 1]) * 0.5;
  const mz = (positions[i3 + 2] + positions[j3 + 2]) * 0.5;
  // 半径の二乗
  const dx = positions[i3] - positions[j3];
  const dy = positions[i3 + 1] - positions[j3 + 1];
  const dz = positions[i3 + 2] - positions[j3 + 2];
  const radiusSq = (dx * dx + dy * dy + dz * dz) * 0.25;

  for (let k = 0; k < n; k++) {
    if (k === i || k === j) continue;
    const k3 = k * 3;
    const ex = positions[k3] - mx;
    const ey = positions[k3 + 1] - my;
    const ez = positions[k3 + 2] - mz;
    if (ex * ex + ey * ey + ez * ez < radiusSq) return false;
  }
  return true;
}
```

### 3.3 測地線弧の描画

直線エッジと球面に沿った弧（測地線）を切り替えるオプションを追加する。

- **直線**: Phase 1 と同じ。2 点をそのまま `LineSegments` で接続
- **測地線弧**: 2 点間の大円弧を分割点で近似し、`Line` で描画

弧の分割数は固定値（8–16 セグメント）とする。エッジ数 × 分割数の頂点が必要になるため、セグメント数は抑える。

```typescript
/** 球面上の 2 点間の測地線弧を分割点列で返す */
function geodesicArc(
  p1: [number, number, number],
  p2: [number, number, number],
  radius: number,
  segments: number,
): Float32Array {
  // slerp (球面線形補間) で p1 → p2 を segments 分割
  // 各分割点を radius にスケーリング
}
```

測地線弧モードでは `LineSegments` の代わりに `BufferGeometry` + `Line` を使い、セグメント間の連続線として描画する。

### 3.4 params.ts の追加フィールド

```typescript
// Phase 2 で追加するパラメータ
interface NodeGardenParams {
  // ... Phase 1 のフィールド ...

  /** エッジ計算アルゴリズム */
  edgeAlgorithm: EdgeAlgorithm;
  /** k-NN の接続数 */
  knnK: number;
  /** エッジ経路の描画方式 */
  edgePathMode: "straight" | "geodesic";
  /** 測地線弧の分割数 */
  geodesicSegments: number;
}

// デフォルト値の追加分
const phase2Defaults = {
  edgeAlgorithm: "distance" as EdgeAlgorithm,
  knnK: 5,
  edgePathMode: "straight" as const,
  geodesicSegments: 12,
};
```

### 3.5 平面グラフ特性の一覧

| アルゴリズム | 平面グラフ   | エッジ密度       | パラメータ依存    |
| ------------ | ------------ | ---------------- | ----------------- |
| 距離閾値     | 保証なし     | 閾値依存で変動大 | `edgeMaxDistance` |
| k-NN         | 保証なし     | k に比例         | `knnK`            |
| ~~ドロネー~~ | ~~保証あり~~ | ~~約 3N~~        | 断念              |
| MST          | 保証あり     | N - 1（最疎）    | なし              |
| Gabriel      | 保証あり     | MST 以上         | なし              |

## 4. 実装仕様

### 4.1 モジュール構成の判断

5 つのアルゴリズムを全て `simulation.ts` に書くと肥大化する。以下の基準で分割を判断する。

- 各アルゴリズムが 50 行未満: `simulation.ts` 内に全て配置
- 50 行以上のアルゴリズムが 2 つ以上: `src/models/node-garden/edges/` ディレクトリに分割

ドロネー三角形分割は凸包計算を含むため 50 行を超える見込みが高い。分割を前提として設計する。

想定構成:

```
src/models/node-garden/
├── edges/
│   ├── distance.ts      # 距離閾値 (Phase 1 から移設)
│   ├── knn.ts           # k-最近傍
│   ├── mst.ts           # 最小全域木
│   ├── gabriel.ts       # Gabriel グラフ
│   ├── geodesic.ts      # 測地線弧の補間ユーティリティ
│   └── index.ts         # EdgeStrategy マップの集約 export
├── simulation.ts        # NodeState 管理 (配置・運動)
├── params.ts
├── index.ts
└── mod.ts
```

### 4.2 GUI 追加

```typescript
const edgesFolder = gui.addFolder("Edges");
edgesFolder.add(params, "edgeAlgorithm", ["distance", "knn", "mst", "gabriel"]).name("Algorithm");
edgesFolder.add(params, "knnK", 1, 15, 1).name("k-NN k");
edgesFolder.add(params, "edgeMaxDistance", 0.1, 2.0, 0.05).name("Max Distance");
edgesFolder.add(params, "edgePathMode", ["straight", "geodesic"]).name("Edge Path");
edgesFolder.add(params, "geodesicSegments", 4, 24, 2).name("Arc Segments");
```

`edgeAlgorithm` が `distance` / `knn` のときのみ各固有パラメータを表示する制御は、lil-gui の `show()` / `hide()` で対応する。

## 5. テスト方針

### ユニットテスト

| テスト対象            | 検証内容                                | 入力例             | 期待結果                      |
| --------------------- | --------------------------------------- | ------------------ | ----------------------------- |
| `computeKnnEdges`     | k=1 で最近傍のみ接続                    | 3 ノード、距離既知 | 最短ペアのみがエッジ          |
| `computeKnnEdges`     | k=N-1 で完全グラフ                      | 5 ノード、k=4      | 全ペア接続 (10 エッジ)        |
| `computeKnnEdges`     | 対称化: A→B あり B→A なしでもエッジ生成 | 非対称な距離配置   | 和集合でエッジ生成            |
| `computeMstEdges`     | エッジ数 = N - 1                        | 20 ノード          | `count === 19`                |
| `computeMstEdges`     | 全ノード連結                            | 20 ノード          | Union-Find で全ノード同一成分 |
| `computeMstEdges`     | 距離既知の 3 点                         | 三角形の 3 点      | 最短 2 辺を選択               |
| `computeGabrielEdges` | 直径球内に他点なし → 接続               | 2 点のみ           | 1 エッジ                      |
| `computeGabrielEdges` | 直径球内に他点あり → 非接続             | 3 点一直線         | 端–端間のエッジなし           |
| `edgeStrategies`      | 全アルゴリズムが EdgeStrategy 型に適合  | 各関数             | 型検査で保証                  |
| `geodesicArc`         | 同一点 → 長さ 0                         | p1 === p2          | 空 or 1 点                    |
| `geodesicArc`         | 対蹠点 → 大円半周                       | 対蹠 2 点          | segments 分割の半円弧         |

### 統合テスト

Phase 2 でも統合テストは設けない。

## 6. 実装チェックリスト

- [x] `params.ts` にエッジ関連パラメータ追加
- [x] `EdgeStrategy` 型・`edgeStrategies` マップ定義
- [x] `edges/` ディレクトリ作成・モジュール分割
- [x] `computeDistanceEdges` を `edges/distance.ts` に移設
- [x] `computeKnnEdges` 実装
- [x] `computeDelaunayEdges` — 断念（動的ノードでのチラつきが不可避のため）
- [x] `computeMstEdges` 実装（Kruskal + Union-Find）
- [x] `computeGabrielEdges` 実装
- [x] `geodesicArc` 実装（slerp ベース）
- [x] `index.ts` に測地線弧描画モード追加
- [x] GUI にアルゴリズム切替・パラメータ追加
- [x] `mod.ts` export 更新
- [x] 全アルゴリズムのユニットテスト
- [x] 100 ノードでの各アルゴリズム実行時間を計測し 50 ms 以内を確認
- [x] テスト実行・全パス確認
- [x] レビュー完了
