# Phase 3: ビジュアル仕上げ 仕様書

## 1. 概要

### 1.1 目的

Phase 1–2 で構築したシミュレーション基盤の上に、ミリタリー HUD / FUI テーマのビジュアルを完成させる。カスタムポイントシェーダ、エッジ描画スタイルの多様化、TSL ベースのブルームポストプロセス、球体オーバーレイを実装する。

### 1.2 用語定義

| 用語         | 定義                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| TSL          | Three.js Shading Language。WebGPURenderer のノードベースシェーダ記述言語 |
| ブルーム     | 高輝度部分が周囲に滲み出る光学効果。ポストプロセスで実現する             |
| SDF          | Signed Distance Field。形状をピクセル単位で距離関数で描画する手法        |
| ブリージング | 不透明度が緩やかに増減する明滅アニメーション                             |
| パルス       | エッジ上を光の帯が走るアニメーション                                     |
| シグナル伝搬 | ノード間をパケット（小さな光点）が移動するアニメーション                 |

### 1.3 背景・問題

Phase 1–2 は `PointsMaterial` + `LineBasicMaterial` による素朴な描画のままであり、HUD テーマの要件（グロー、形状バリエーション、エッジアニメーション）を満たしていない。

### 1.4 期待効果

| 指標           | 現状 (Phase 2 完了時)    | 目標                                                          |
| -------------- | ------------------------ | ------------------------------------------------------------- |
| ノード描画     | 丸点（`PointsMaterial`） | SDF ベースの HUD 形状（十字, 菱形, 円, 六角形）               |
| エッジ描画     | 一様な線                 | 5 スタイル切替（solid, フェード, パルス, 伝搬, ブリージング） |
| ポストプロセス | なし                     | TSL ベースブルーム                                            |
| 球体表示       | なし                     | 緯度経度グリッド（オプション）                                |

### 1.5 着手条件

- [ ] Phase 2 の実装・テスト完了
- [ ] WebGPURenderer + TSL の動作検証済み

## 2. 対象ファイル

| ファイル                           | 変更種別 | 変更内容                                                       |
| ---------------------------------- | -------- | -------------------------------------------------------------- |
| `src/models/node-garden/shaders/`  | 新規     | TSL ベースのカスタムシェーダモジュール                         |
| `src/models/node-garden/params.ts` | 修正     | ビジュアル関連パラメータ追加                                   |
| `src/models/node-garden/index.ts`  | 修正     | シェーダマテリアル・ポストプロセス・球体オーバーレイの組み込み |
| `src/models/node-garden/mod.ts`    | 修正     | export 更新                                                    |
| `src/core/renderer.ts`             | 修正     | ポストプロセスパイプライン対応（必要に応じて）                 |

## 3. 設計方針

### 3.1 ノードシェーダ（SDF ベース）

`PointsMaterial` を TSL の `SpriteNodeMaterial`（または `PointsNodeMaterial`）に置き換え、フラグメントシェーダで SDF 形状を描画する。

切り替え可能な形状:

| 形状             | SDF                                     | HUD との相性           |
| ---------------- | --------------------------------------- | ---------------------- |
| 円（デフォルト） | `length(uv) - radius`                   | 汎用                   |
| 十字             | `min(abs(uv.x), abs(uv.y)) - thickness` | レーダーマーカー       |
| 菱形             | `abs(uv.x) + abs(uv.y) - size`          | ターゲットインジケータ |
| 六角形           | 六角の SDF 関数                         | テクノロジー感         |

全形状で外縁にアンチエイリアス（`smoothstep`）を適用し、中心からのグロー減衰（`exp(-dist * glowFalloff)`）を加える。

```typescript
// TSL ノードでの SDF 形状切替の概念コード
// 実装時は Three.js の TSL API (tslFn, uniform, etc.) を使用する
const shapeSdf = tslFn(([uv, shapeId]) => {
  // shapeId に応じた SDF 計算
  // 0: circle, 1: cross, 2: diamond, 3: hexagon
});
```

### 3.2 エッジ描画スタイル

5 種類のスタイルを `edgeStyle` パラメータで切り替える。

#### solid（一様）

Phase 1–2 と同一。`LineBasicMaterial` で色・不透明度を固定。

#### distance-fade（距離フェード）

エッジの長さに応じて不透明度を減衰させる。短いエッジは不透明、長いエッジは薄い。

- 実装: 描画ループ内でエッジごとに `distances[i] / edgeMaxDistance` を算出し、`LineBasicMaterial` では一括制御が難しいため、頂点カラーの alpha で制御する
- `vertexColors: true` + `BufferAttribute` で各頂点の色・alpha を設定

```typescript
// エッジ i の不透明度
const t = distances[i] / maxVisibleDistance;
const alpha = 1.0 - t * t; // 二次減衰
```

#### pulse（パルスアニメーション）

エッジ上を光の帯が周期的に移動する。

- 実装: TSL の `LineNodeMaterial` が利用可能であればそれを使用。利用不可の場合は `ShaderMaterial` で頂点位置に基づく UV を生成し、`fract(uv - time * speed)` でパルスパターンを描画する
- パルス幅・速度・繰り返し間隔は `params` で設定

#### signal（シグナル伝搬）

エッジ上を小さな光点（パケット）が移動する。

- 実装: エッジの始点→終点をパケットが往復する。パケット位置 = `lerp(p1, p2, fract(time * speed))`
- パケットは追加の `Points` ジオメトリとして描画する（エッジあたり 0–1 個）
- パケットの発生頻度と同時存在数はパラメータで指定
- パケット用の `PointsMaterial`（or SDF シェーダ）は小さな発光する丸点

#### breathing（ブリージング）

エッジ全体の不透明度が正弦波で緩やかに明滅する。

- 実装: `lineMat.opacity = baseOpacity * (0.5 + 0.5 * sin(time * breathSpeed))`
- 全エッジ一括、個別ノイズは不要（一体感を出す）

### 3.3 params.ts の追加フィールド

```typescript
// Phase 3 で追加するパラメータ
interface NodeGardenParams {
  // ... Phase 1–2 のフィールド ...

  /** ノード形状 */
  nodeShape: "circle" | "cross" | "diamond" | "hexagon";
  /** ノードのグロー強度 (0 で無効) */
  nodeGlowIntensity: number;

  /** エッジ描画スタイル */
  edgeStyle: "solid" | "distance-fade" | "pulse" | "signal" | "breathing";
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

  /** 球体グリッド表示 */
  sphereGridVisible: boolean;
  /** 球体グリッドの不透明度 */
  sphereGridOpacity: number;
}

// デフォルト値の追加分
const phase3Defaults = {
  nodeShape: "circle" as const,
  nodeGlowIntensity: 0.3,

  edgeStyle: "solid" as const,
  pulseSpeed: 1.0,
  pulseWidth: 0.15,
  signalSpeed: 0.8,
  breathingSpeed: 0.5,

  bloomEnabled: true,
  bloomStrength: 0.6,
  bloomRadius: 0.3,
  bloomThreshold: 0.1,

  sphereGridVisible: false,
  sphereGridOpacity: 0.08,
};
```

### 3.4 TSL ベースブルーム

WebGPURenderer は従来の `EffectComposer` + `UnrealBloomPass` との互換性がない。TSL のポストプロセスノードを使用する。

Three.js r160+ では `postProcessing` プロパティと `pass()` / `bloom()` ノードが利用可能（仮説 — 実装時に API の現状を検証する必要あり）。

実装方針:

1. Three.js の TSL ポストプロセス API を調査する
2. API が安定していればそのまま使用する
3. API が不安定・未提供の場合、2 パスレンダリング（輝度抽出 → ガウスぼかし → 加算合成）を TSL のカスタムシェーダで自前実装する

ブルームのパラメータ（strength, radius, threshold）を GUI から操作可能にする。

### 3.5 球体グリッドオーバーレイ

半径 `sphereRadius` の球に緯度経度線を表示するオプション。

- 実装: `THREE.LineSegments` で緯度線（水平）・経度線（垂直）を生成
- 緯度線: 10° 間隔の小円（18 本）
- 経度線: 15° 間隔の大円（12 本）
- 各線は 64 セグメントの折れ線で近似
- 色: `nodeColor` の不透明度 `sphereGridOpacity`（5–10%）
- `sphereGridVisible` パラメータで表示・非表示を切り替え

```typescript
function createSphereGrid(
  radius: number,
  latitudeStep: number,
  longitudeStep: number,
  segments: number,
): THREE.BufferGeometry {
  // 緯度線・経度線の頂点を生成し、LineSegments 用 BufferGeometry に格納
}
```

## 4. 実装仕様

### 4.1 シェーダモジュール構成

```
src/models/node-garden/shaders/
├── node-shapes.ts     # SDF 形状関数群 (TSL)
├── edge-styles.ts     # エッジ描画スタイル用マテリアル生成
└── bloom.ts           # ブルームポストプロセス設定
```

### 4.2 ノード形状の切替

`nodeShape` 変更時にマテリアルを再構築する。`PointsMaterial` → TSL ベースの `NodeMaterial` に置き換えるため、形状切替はシェーダ内の uniform 値の変更で対応する（マテリアル再構築を避ける）。

```typescript
// uniform で形状 ID を渡す
const shapeUniform = uniform(0); // 0: circle, 1: cross, 2: diamond, 3: hexagon

// GUI 変更時
params.nodeShape = "cross";
shapeUniform.value = shapeIndexMap[params.nodeShape];
```

### 4.3 GUI 追加

```typescript
const visualFolder = gui.addFolder("Visual");

visualFolder.add(params, "nodeShape", ["circle", "cross", "diamond", "hexagon"]).name("Node Shape");
visualFolder.add(params, "nodeGlowIntensity", 0, 1, 0.05).name("Node Glow");

const edgeStyleFolder = gui.addFolder("Edge Style");
edgeStyleFolder
  .add(params, "edgeStyle", ["solid", "distance-fade", "pulse", "signal", "breathing"])
  .name("Style");
edgeStyleFolder.add(params, "pulseSpeed", 0.1, 5, 0.1).name("Pulse Speed");
edgeStyleFolder.add(params, "signalSpeed", 0.1, 3, 0.1).name("Signal Speed");
edgeStyleFolder.add(params, "breathingSpeed", 0.1, 2, 0.05).name("Breath Speed");

const bloomFolder = gui.addFolder("Bloom");
bloomFolder.add(params, "bloomEnabled").name("Enabled");
bloomFolder.add(params, "bloomStrength", 0, 2, 0.05).name("Strength");
bloomFolder.add(params, "bloomRadius", 0, 1, 0.05).name("Radius");
bloomFolder.add(params, "bloomThreshold", 0, 1, 0.05).name("Threshold");

const gridFolder = gui.addFolder("Sphere Grid");
gridFolder.add(params, "sphereGridVisible").name("Visible");
gridFolder.add(params, "sphereGridOpacity", 0.01, 0.2, 0.01).name("Opacity");
```

## 5. テスト方針

### ユニットテスト

Phase 3 は大部分が描画コード（GPU シェーダ・マテリアル・ポストプロセス）であり、カバレッジ対象外。テスト可能な純粋関数のみ対象とする。

| テスト対象              | 検証内容                              | 入力例                   | 期待結果         |
| ----------------------- | ------------------------------------- | ------------------------ | ---------------- |
| `createSphereGrid`      | 頂点数が緯度 × 経度 × segments に一致 | 10° lat, 15° lon, 64 seg | 計算値と一致     |
| 距離フェード alpha 計算 | 距離 0 → alpha 1.0                    | `dist=0, max=1`          | `1.0`            |
| 距離フェード alpha 計算 | 距離 = max → alpha 0.0                | `dist=1, max=1`          | `0.0`            |
| パラメータデフォルト値  | 全フィールドが妥当                    | —                        | 型・範囲チェック |

### 統合テスト

設けない。ビジュアルの検証は目視確認で行う。

## 6. 実装チェックリスト

- [ ] `shaders/node-shapes.ts` — SDF 形状関数（circle, cross, diamond, hexagon）
- [ ] ノード描画を TSL ベースマテリアルに置き換え
- [ ] `nodeShape` uniform 切替の実装
- [ ] ノードグロー減衰の実装
- [ ] `shaders/edge-styles.ts` — distance-fade マテリアル
- [ ] pulse エッジスタイル実装
- [ ] signal（パケット伝搬）エッジスタイル実装
- [ ] breathing エッジスタイル実装
- [ ] `edgeStyle` GUI 切替の実装
- [ ] `shaders/bloom.ts` — TSL ブルームポストプロセス
- [ ] ブルーム GUI コントロール
- [ ] 球体グリッドオーバーレイ生成
- [ ] `sphereGridVisible` 切替の実装
- [ ] `params.ts` に Phase 3 パラメータ追加
- [ ] `mod.ts` export 更新
- [ ] テスト追加・実行
- [ ] 目視での HUD テーマ品質確認
- [ ] レビュー完了
