# Phase 4: 動的機能 + 最適化 仕様書

## 1. 概要

### 1.1 目的

ノードの動的な出現・消失のアニメーションを追加し、GUI を整理し、100 ノード時のパフォーマンスを検証・最適化する。全フェーズの仕上げとして、操作性と安定性を確保する。

### 1.2 用語定義

| 用語               | 定義                                                |
| ------------------ | --------------------------------------------------- |
| スポーン           | ノードが新たに出現すること                          |
| デスポーン         | ノードが消失すること                                |
| ライフタイム       | ノードの出現から消失までの生存期間                  |
| フェードイン       | 不透明度 0 → 1 の遷移。スポーン時のアニメーション   |
| フェードアウト     | 不透明度 1 → 0 の遷移。デスポーン時のアニメーション |
| フレームバジェット | 1 フレームに許容される処理時間。60fps で約 16.7 ms  |

### 1.3 背景・問題

Phase 1–3 ではノード数が固定で、起動時に全ノードが一斉に出現する。動的なノード増減は視覚的な動きが増え、ネットワークの「生きている感」を演出できる。また、GUI パラメータが Phase 1–3 で累積し、操作性が低下している可能性がある。

### 1.4 期待効果

| 指標                   | 現状 (Phase 3 完了時) | 目標                                           |
| ---------------------- | --------------------- | ---------------------------------------------- |
| ノード増減             | 固定（リビルド必要）  | 動的スポーン / デスポーン                      |
| フェードアニメーション | なし                  | フェードイン / フェードアウト（0.3–1.0 s）     |
| GUI 構成               | 未整理（フラット）    | フォルダ階層で整理、関連パラメータのグループ化 |
| GUI 操作レスポンス     | 未計測                | 500 ms 以内（100 ノード時）                    |
| フレームレート         | 未計測                | 60 fps 安定（100 ノード、エッジ含む）          |

### 1.5 着手条件

- [ ] Phase 3 の実装・テスト完了
- [ ] Phase 1–3 の GUI パラメータ一覧が確定している

## 2. 対象ファイル

| ファイル                                      | 変更種別 | 変更内容                                                           |
| --------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `src/models/node-garden/simulation.ts`        | 修正     | ノードのライフサイクル管理（スポーン / デスポーン / フェード状態） |
| `src/models/node-garden/params.ts`            | 修正     | 動的ノード関連パラメータ追加、GUI 整理用フォルダ構成の定義         |
| `src/models/node-garden/index.ts`             | 修正     | フェードイン / フェードアウトの描画反映、GUI 再構成                |
| `src/models/node-garden/mod.ts`               | 修正     | export 更新                                                        |
| `tests/models/node-garden/simulation.test.ts` | 修正     | ライフサイクルのテスト追加                                         |

## 3. 設計方針

### 3.1 ノードのライフサイクル

各ノードに状態（ライフサイクルフェーズ）を持たせる。

```typescript
/** ノードのライフサイクル状態 */
export type NodeLifecycle = "spawning" | "alive" | "despawning" | "dead";
```

状態遷移:

```
dead → spawning → alive → despawning → dead → ...
```

- **dead**: スロットが空き。描画しない。エッジ計算から除外
- **spawning**: フェードイン中。不透明度が 0 → 1 に遷移。エッジ計算に含める（フェード中でも接続される）
- **alive**: 通常状態。不透明度 1.0
- **despawning**: フェードアウト中。不透明度が 1 → 0 に遷移。エッジ計算に含める

### 3.2 NodeState の拡張

```typescript
export interface NodeState {
  // ... Phase 1 のフィールド ...

  /** 各ノードのライフサイクル状態 (0=dead, 1=spawning, 2=alive, 3=despawning) */
  lifecycles: Uint8Array;
  /** フェード進捗 (0.0–1.0)。spawning: 0→1、despawning: 1→0 */
  fadeProgress: Float32Array;
  /** 各ノードの残りライフタイム (秒)。alive 状態のカウントダウン */
  lifetimes: Float32Array;
  /** 現在のアクティブノード数 (dead 以外) */
  activeCount: number;
  /** 最大ノード数 (配列確保サイズ) */
  maxNodeCount: number;
}
```

`maxNodeCount` は `params.nodeCount` と一致させ、配列は最大サイズで確保する。`activeCount` はアクティブなスロット数を追跡する。

### 3.3 スポーン / デスポーンの制御

```typescript
/** 動的ノード更新: スポーン / デスポーン / フェード進行 */
export function updateNodeLifecycles(
  state: NodeState,
  params: NodeGardenParams,
  delta: number,
): void;
```

処理フロー:

1. **フェード進行**: `spawning` / `despawning` のノードの `fadeProgress` を `delta / fadeDuration` だけ進める
2. **状態遷移**: `fadeProgress` が 1.0 に達したら `spawning → alive`、0.0 に達したら `despawning → dead`
3. **ライフタイム減少**: `alive` ノードの `lifetimes` を `delta` だけ減らす。0 以下になったら `alive → despawning`
4. **スポーン判定**: `activeCount < nodeCount` かつ一定間隔（`spawnInterval`）が経過していたら、`dead` スロットを 1 つ選び `dead → spawning`

スポーンのタイミングはランダム化する。`spawnInterval` を基準にポアソン的な揺らぎを持たせ、一定間隔での機械的なスポーンを避ける。

### 3.4 ライフタイムの決定

ノードスポーン時にライフタイムを設定する。

```typescript
lifetime = lifetimeMin + Math.random() * (lifetimeMax - lifetimeMin);
```

`dynamicNodes = false` のとき、ライフタイムを `Infinity` に設定してスポーン後は永続化する。

### 3.5 描画への反映

ノードの不透明度を `fadeProgress` で制御する。

- `Points` の頂点カラーの alpha チャネルに `fadeProgress` を格納
- Phase 3 の SDF シェーダに `fadeProgress` を uniform（または attribute）で渡し、不透明度を乗算
- `dead` スロットは位置を `(0, 0, 0)` + point size 0 に設定して描画コストを抑える、または draw range で除外

エッジ描画: `dead` ノードに接続するエッジは描画しない。`spawning` / `despawning` ノードのエッジは当該ノードの `fadeProgress` に応じて不透明度を減衰させる。

### 3.6 params.ts の追加フィールド

```typescript
// Phase 4 で追加するパラメータ
interface NodeGardenParams {
  // ... Phase 1–3 のフィールド ...

  /** 動的ノード有効 */
  dynamicNodes: boolean;
  /** フェードイン / フェードアウト時間 (秒) */
  fadeDuration: number;
  /** スポーン間隔の基準値 (秒) */
  spawnInterval: number;
  /** ライフタイム下限 (秒) */
  lifetimeMin: number;
  /** ライフタイム上限 (秒) */
  lifetimeMax: number;
}

// デフォルト値の追加分
const phase4Defaults = {
  dynamicNodes: false,
  fadeDuration: 0.5,
  spawnInterval: 1.0,
  lifetimeMin: 5.0,
  lifetimeMax: 15.0,
};
```

`dynamicNodes = false` のデフォルトで、Phase 1–3 と同じ挙動（全ノード即時出現・永続）を維持する。

### 3.7 GUI 再構成

Phase 1–3 で累積したパラメータを以下のフォルダ階層に整理する。

```
Node Garden
├── Simulation
│   ├── Node Count: 60
│   ├── Sphere Radius: 1.0
│   ├── Surface ε: 0.02
│   ├── Speed: 1.0
│   ├── Angular Speed Min: 0.1
│   ├── Angular Speed Max: 0.5
│   └── Force Great Circle: false
├── Edges
│   ├── Algorithm: distance
│   ├── Max Distance: 0.6
│   ├── k-NN k: 5
│   ├── Edge Path: straight
│   └── Arc Segments: 12
├── Visual
│   ├── Node Shape: circle
│   ├── Node Glow: 0.3
│   ├── Point Size: 0.05
│   ├── Edge Style: solid
│   ├── Pulse Speed: 1.0
│   ├── Signal Speed: 0.8
│   └── Breath Speed: 0.5
├── Bloom
│   ├── Enabled: true
│   ├── Strength: 0.6
│   ├── Radius: 0.3
│   └── Threshold: 0.1
├── Sphere Grid
│   ├── Visible: false
│   └── Opacity: 0.08
├── Dynamic Nodes
│   ├── Enabled: false
│   ├── Fade Duration: 0.5
│   ├── Spawn Interval: 1.0
│   ├── Lifetime Min: 5.0
│   └── Lifetime Max: 15.0
└── Colors
    ├── Node: #00BFFF
    ├── Edge: #00BFFF
    └── Background: #0A0F1A
```

条件付き表示: `dynamicNodes = false` のとき Dynamic Nodes フォルダ内のサブ項目を非表示にする。同様に `edgeAlgorithm` に応じて不要なパラメータを隠す。

### 3.8 パフォーマンス目標と最適化方針

#### 目標

| 条件                                                     | 指標           | 目標値   |
| -------------------------------------------------------- | -------------- | -------- |
| 100 ノード + ドロネーエッジ + ブルーム                   | フレームレート | 60 fps   |
| GUI パラメータ変更（リビルド不要）                       | レスポンス     | < 100 ms |
| GUI パラメータ変更（リビルドあり: nodeCount, algorithm） | レスポンス     | < 500 ms |

#### 最適化候補

以下は計測結果に基づいて判断する。事前の過剰最適化は行わない。

| ボトルネック候補                        | 対策                                                                         | Phase              |
| --------------------------------------- | ---------------------------------------------------------------------------- | ------------------ |
| エッジ全ペア走査 (O(N²))                | N ≤ 100 なら問題ない見込み。計測して判断                                     | -                  |
| ドロネー計算 (凸包)                     | 毎フレーム再計算を避け、位置変化の閾値で再計算をトリガー                     | Phase 4            |
| ブルームポストプロセス                  | 解像度の 1/2 でぼかし処理。ping-pong バッファ数の調整                        | Phase 4            |
| Points / LineSegments の attribute 更新 | `BufferAttribute.needsUpdate` の設定を最小限に。変更がないフレームはスキップ | Phase 4            |
| GUI 操作時のリビルド                    | `nodeCount` 変更時のみ配列再確保。他のパラメータは再確保なし                 | Phase 1 で設計済み |

#### 計測方法

- `performance.now()` でフレームごとの処理時間を計測
- シミュレーション更新、エッジ計算、描画同期の各段階を個別計測
- GUI に fps / frame time の表示を追加（`Stats.js` or 自前実装）

## 4. 実装仕様

### 4.1 updateNodeLifecycles の詳細

```typescript
export function updateNodeLifecycles(
  state: NodeState,
  params: NodeGardenParams,
  delta: number,
): void {
  if (!params.dynamicNodes) return;

  const fadeStep = delta / params.fadeDuration;

  for (let i = 0; i < state.maxNodeCount; i++) {
    const lc = state.lifecycles[i];

    if (lc === 1) {
      // spawning
      state.fadeProgress[i] = Math.min(1.0, state.fadeProgress[i] + fadeStep);
      if (state.fadeProgress[i] >= 1.0) {
        state.lifecycles[i] = 2; // → alive
      }
    } else if (lc === 2) {
      // alive
      state.lifetimes[i] -= delta;
      if (state.lifetimes[i] <= 0) {
        state.lifecycles[i] = 3; // → despawning
      }
    } else if (lc === 3) {
      // despawning
      state.fadeProgress[i] = Math.max(0.0, state.fadeProgress[i] - fadeStep);
      if (state.fadeProgress[i] <= 0.0) {
        state.lifecycles[i] = 0; // → dead
        state.activeCount--;
      }
    }
  }

  // スポーン判定 (spawnInterval に揺らぎを持たせる)
  // 実装時に spawnTimer をクロージャまたは state に保持
}
```

### 4.2 スポーン処理

```typescript
function spawnNode(state: NodeState, params: NodeGardenParams): void {
  // dead スロットを探す
  let slot = -1;
  for (let i = 0; i < state.maxNodeCount; i++) {
    if (state.lifecycles[i] === 0) {
      slot = i;
      break;
    }
  }
  if (slot === -1) return; // 空きなし

  // 球面上のランダム位置を生成
  const [x, y, z] = randomPointOnSphere();
  const r = params.sphereRadius * (1 + (Math.random() * 2 - 1) * params.surfaceEpsilon);

  const i3 = slot * 3;
  state.initialPositions[i3] = x * r;
  state.initialPositions[i3 + 1] = y * r;
  state.initialPositions[i3 + 2] = z * r;
  state.positions[i3] = x * r;
  state.positions[i3 + 1] = y * r;
  state.positions[i3 + 2] = z * r;
  state.radii[slot] = r;

  // ランダム回転軸・角速度
  const [ax, ay, az] = randomPointOnSphere();
  state.axes[i3] = ax;
  state.axes[i3 + 1] = ay;
  state.axes[i3 + 2] = az;
  state.angles[slot] = 0;
  state.angularSpeeds[slot] =
    params.angularSpeedMin + Math.random() * (params.angularSpeedMax - params.angularSpeedMin);

  // ライフサイクル初期化
  state.lifecycles[slot] = 1; // spawning
  state.fadeProgress[slot] = 0;
  state.lifetimes[slot] =
    params.lifetimeMin + Math.random() * (params.lifetimeMax - params.lifetimeMin);
  state.activeCount++;
}
```

### 4.3 エッジ計算との統合

全エッジ計算関数は `lifecycles[i] !== 0`（dead 以外）のノードのみを対象とする。Phase 2 の `EdgeStrategy` シグネチャを変更せず、各関数内で `dead` スロットをスキップする。

```typescript
// 判定の追加 (各アルゴリズム共通)
if (state.lifecycles[i] === 0 || state.lifecycles[j] === 0) continue;
```

### 4.4 初期スポーンシーケンス

`dynamicNodes = true` の初回起動時、全ノードを一斉にスポーンさせるのではなく、短い間隔（`spawnInterval * 0.2` 程度）で順次スポーンさせる。起動時の「ノードが次々と現れる」演出になる。

`dynamicNodes = false` のとき、従来どおり `createNodeState` で全ノードを即時配置し、`lifecycles` は全て `alive`、`fadeProgress` は全て `1.0` に設定する。

## 5. テスト方針

### ユニットテスト

| テスト対象             | 検証内容                            | 入力例                              | 期待結果                                    |
| ---------------------- | ----------------------------------- | ----------------------------------- | ------------------------------------------- |
| `updateNodeLifecycles` | spawning → alive 遷移               | fadeProgress 0.9, delta で 1.0 超え | `lifecycle === 2`                           |
| `updateNodeLifecycles` | alive → despawning 遷移             | lifetime を 0 以下に                | `lifecycle === 3`                           |
| `updateNodeLifecycles` | despawning → dead 遷移              | fadeProgress 0.1, delta で 0.0 以下 | `lifecycle === 0`, `activeCount` 減少       |
| `updateNodeLifecycles` | dynamicNodes=false で何も変化しない | 任意                                | 全状態不変                                  |
| `spawnNode`            | dead スロットに配置                 | 空きスロットあり                    | `lifecycle === 1`, `activeCount` 増加       |
| `spawnNode`            | 空きなし時は何も起きない            | 全スロット alive                    | `activeCount` 不変                          |
| `spawnNode`            | 初期位置が球面上                    | ε=0                                 | 原点距離 = sphereRadius                     |
| ライフタイム           | 範囲内で設定                        | min=5, max=15                       | `5 ≤ lifetime ≤ 15`                         |
| エッジ計算             | dead ノードがエッジに含まれない     | dead スロットあり                   | dead ノードのインデックスがペアに出現しない |

### パフォーマンステスト

手動計測。テスト自動化は行わない。

| 条件                             | 計測項目     | 合格基準           |
| -------------------------------- | ------------ | ------------------ |
| 100 ノード + ドロネー + ブルーム | フレーム時間 | < 16.7 ms (60 fps) |
| nodeCount を 10 → 100 に変更     | レスポンス   | < 500 ms           |
| edgeAlgorithm 切替               | レスポンス   | < 500 ms           |
| edgeStyle 切替                   | レスポンス   | < 100 ms           |

## 6. 実装チェックリスト

- [ ] `NodeState` にライフサイクル関連フィールド追加
- [ ] `updateNodeLifecycles` 実装
- [ ] `spawnNode` 実装
- [ ] `dynamicNodes = false` で従来互換を確認
- [ ] 初期スポーンシーケンスの実装
- [ ] フェード描画反映（Points の頂点 alpha）
- [ ] dead ノードのエッジ除外
- [ ] `params.ts` に Phase 4 パラメータ追加
- [ ] GUI フォルダ階層の再構成
- [ ] 条件付き表示（パラメータの動的 show/hide）
- [ ] パフォーマンス計測（fps / frame time）
- [ ] 100 ノード時の計測 → ボトルネック特定
- [ ] 必要に応じた最適化の適用
- [ ] テスト追加・全パス確認
- [ ] レビュー完了
