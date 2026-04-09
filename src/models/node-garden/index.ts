import * as THREE from "three";
import type { RendererContext } from "../../core";
import { createGui } from "../../core";
import { createNodeState, updateNodePositions } from "./simulation";
import { edgeStrategies, geodesicArc } from "./edges";
import type { NodeGardenParams } from "./params";
import type { NodeState, EdgeResult } from "./simulation";
import { defaultParams } from "./params";
import {
  createNodeShapeMaterial,
  shapeIndexMap,
  applyDistanceFadeColors,
  computeBreathingOpacity,
  configureEdgeMaterial,
  createBloomPipeline,
} from "./shaders";
import type { BloomPipeline } from "./shaders";
import { createSphereGrid } from "./sphere-grid";
import { InstancedBufferAttribute } from "three/webgpu";
import { instancedBufferAttribute } from "three/tsl";

export interface ThemeHandle {
  update(delta: number): void;
  render(): void;
  dispose(): void;
}

export function setup(ctx: RendererContext): ThemeHandle {
  const { scene, renderer, camera } = ctx;
  const params: NodeGardenParams = { ...defaultParams };
  let state: NodeState = createNodeState(params);

  // ── 背景 ──
  scene.background = new THREE.Color(params.backgroundColor);

  // ── ノード (Sprite×N インスタンシング + SDF シェーダ) ──
  // PointsNodeMaterial + Sprite + positionNode で、球面上の各位置に
  // 個別の SDF スプライトをインスタンス描画する。
  const nodeShader = createNodeShapeMaterial(params.nodeColor, params.nodeGlowIntensity);
  nodeShader.material.size = params.pointSize;
  nodeShader.material.sizeAttenuation = true;
  nodeShader.shapeUniform.value = shapeIndexMap[params.nodeShape];

  let posAttr = new InstancedBufferAttribute(state.positions, 3);
  nodeShader.material.positionNode = instancedBufferAttribute(posAttr);

  const nodeSprite = new THREE.Sprite(nodeShader.material);
  nodeSprite.count = state.nodeCount;
  scene.add(nodeSprite);

  // ── エッジ (LineSegments) ──
  const lineGeo = new THREE.BufferGeometry();
  const lineMat = new THREE.LineBasicMaterial({
    color: params.edgeColor,
    transparent: true,
    opacity: params.edgeOpacity,
  });
  const edgeLines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(edgeLines);

  // ── シグナルパケット (Points) ──
  let signalGeo = new THREE.BufferGeometry();
  const signalMat = new THREE.PointsMaterial({
    color: params.nodeColor,
    size: params.pointSize * 0.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
  });
  let signalPoints = new THREE.Points(signalGeo, signalMat);
  signalPoints.visible = false;
  scene.add(signalPoints);

  // ── ベース球体 ──
  const sphereGeo = new THREE.SphereGeometry(params.sphereRadius, 48, 32);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: params.sphereBaseColor,
    transparent: params.sphereBaseMode === "translucent",
    opacity: params.sphereBaseMode === "translucent" ? 0.6 : 1.0,
    side: THREE.FrontSide,
  });
  let sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
  sphereMesh.visible = params.sphereBaseMode !== "none";
  scene.add(sphereMesh);

  // ── 球体グリッド ──
  let gridGeo = createSphereGrid(params.sphereRadius, 10, 15, 64);
  const gridMat = new THREE.LineBasicMaterial({
    color: params.sphereGridColor,
    transparent: true,
    opacity: params.sphereGridOpacity,
  });
  let gridLines = new THREE.LineSegments(gridGeo, gridMat);
  gridLines.visible = params.sphereGridVisible;
  scene.add(gridLines);

  // ── ブルーム ──
  let bloomPipeline: BloomPipeline | null = null;
  if (params.bloomEnabled) {
    bloomPipeline = createBloomPipeline(
      renderer,
      scene,
      camera,
      params.bloomStrength,
      params.bloomRadius,
      params.bloomThreshold,
    );
  }

  // ── 累積時間 (エッジアニメーション用) ──
  let elapsed = 0;
  let lastEdgeResult: EdgeResult | null = null;

  // ── ヘルパー ──
  function syncEdges(): void {
    const strategy = edgeStrategies[params.edgeAlgorithm];
    const result = strategy(state, params);
    const { pairs, count } = result;
    lastEdgeResult = result;

    if (params.edgePathMode === "geodesic") {
      const segs = params.geodesicSegments;
      const vertsPerEdge = (segs + 1) * 2 - 2;
      const maxVerts = count * vertsPerEdge * 3;
      const verts = new Float32Array(maxVerts);
      let offset = 0;

      for (let e = 0; e < count; e++) {
        const a = pairs[e * 2];
        const b = pairs[e * 2 + 1];
        const p1: [number, number, number] = [
          state.positions[a * 3],
          state.positions[a * 3 + 1],
          state.positions[a * 3 + 2],
        ];
        const p2: [number, number, number] = [
          state.positions[b * 3],
          state.positions[b * 3 + 1],
          state.positions[b * 3 + 2],
        ];
        const arc = geodesicArc(p1, p2, params.sphereRadius, segs);
        const arcPoints = arc.length / 3;
        for (let s = 0; s < arcPoints - 1; s++) {
          verts[offset++] = arc[s * 3];
          verts[offset++] = arc[s * 3 + 1];
          verts[offset++] = arc[s * 3 + 2];
          verts[offset++] = arc[(s + 1) * 3];
          verts[offset++] = arc[(s + 1) * 3 + 1];
          verts[offset++] = arc[(s + 1) * 3 + 2];
        }
      }

      lineGeo.setAttribute("position", new THREE.BufferAttribute(verts.subarray(0, offset), 3));
      lineGeo.setDrawRange(0, offset / 3);
    } else {
      const verts = new Float32Array(count * 2 * 3);

      for (let e = 0; e < count; e++) {
        const a = pairs[e * 2];
        const b = pairs[e * 2 + 1];
        const o = e * 6;
        verts[o] = state.positions[a * 3];
        verts[o + 1] = state.positions[a * 3 + 1];
        verts[o + 2] = state.positions[a * 3 + 2];
        verts[o + 3] = state.positions[b * 3];
        verts[o + 4] = state.positions[b * 3 + 1];
        verts[o + 5] = state.positions[b * 3 + 2];
      }

      lineGeo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
      lineGeo.setDrawRange(0, count * 2);
    }

    // distance-fade: 頂点カラーで距離フェードを適用
    if (params.edgeStyle === "distance-fade" && params.edgePathMode === "straight") {
      applyDistanceFadeColors(lineGeo, result, params);
    }
  }

  function syncEdgeStyle(): void {
    configureEdgeMaterial(lineMat, params.edgeStyle);
    signalPoints.visible = params.edgeStyle === "signal";

    if (params.edgeStyle !== "distance-fade") {
      lineMat.color.set(params.edgeColor);
      lineMat.opacity = params.edgeOpacity;
    }
  }

  function updateSignalPackets(): void {
    if (params.edgeStyle !== "signal" || !lastEdgeResult) {
      signalPoints.visible = false;
      return;
    }
    signalPoints.visible = true;

    const { pairs, count } = lastEdgeResult;
    const positions = new Float32Array(count * 3);
    const t = Math.abs(Math.sin(elapsed * params.signalSpeed));

    for (let e = 0; e < count; e++) {
      const a = pairs[e * 2];
      const b = pairs[e * 2 + 1];
      // パケット位置 = lerp(p1, p2, t) — 各エッジに位相差をつける
      const phase = (((e * 0.618) % 1.0) + t) % 1.0;
      positions[e * 3] = state.positions[a * 3] * (1 - phase) + state.positions[b * 3] * phase;
      positions[e * 3 + 1] =
        state.positions[a * 3 + 1] * (1 - phase) + state.positions[b * 3 + 1] * phase;
      positions[e * 3 + 2] =
        state.positions[a * 3 + 2] * (1 - phase) + state.positions[b * 3 + 2] * phase;
    }

    signalGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    signalGeo.setDrawRange(0, count);
  }

  function rebuildSim(): void {
    state = createNodeState(params);

    posAttr = new InstancedBufferAttribute(state.positions, 3);
    nodeShader.material.positionNode = instancedBufferAttribute(posAttr);
    nodeShader.material.needsUpdate = true;

    // Sprite のインスタンス数を更新
    nodeSprite.count = state.nodeCount;

    // 球体グリッドの半径が変わった場合
    scene.remove(gridLines);
    gridGeo.dispose();
    gridGeo = createSphereGrid(params.sphereRadius, 10, 15, 64);
    gridLines = new THREE.LineSegments(gridGeo, gridMat);
    gridLines.visible = params.sphereGridVisible;
    scene.add(gridLines);

    // ベース球体の半径が変わった場合
    scene.remove(sphereMesh);
    sphereMesh.geometry.dispose();
    const newSphereGeo = new THREE.SphereGeometry(params.sphereRadius, 48, 32);
    sphereMesh = new THREE.Mesh(newSphereGeo, sphereMat);
    sphereMesh.visible = params.sphereBaseMode !== "none";
    scene.add(sphereMesh);
  }

  function rebuildBloom(): void {
    bloomPipeline?.dispose();
    bloomPipeline = null;

    if (params.bloomEnabled) {
      bloomPipeline = createBloomPipeline(
        renderer,
        scene,
        camera,
        params.bloomStrength,
        params.bloomRadius,
        params.bloomThreshold,
      );
    }
  }

  // ── GUI ──
  const gui = createGui("Node Garden");

  const nodesFolder = gui.addFolder("Nodes");
  nodesFolder
    .add(params, "nodeCount", 10, 200, 1)
    .name("Count")
    .onChange(() => rebuildSim()).domElement.title = "Number of nodes placed on the sphere surface";
  nodesFolder
    .add(params, "sphereRadius", 0.5, 5, 0.1)
    .name("Sphere Radius")
    .onChange(() => rebuildSim()).domElement.title =
    "Radius of the sphere on which nodes are placed";
  nodesFolder
    .add(params, "surfaceEpsilon", 0, 0.1, 0.005)
    .name("ε Offset")
    .onChange(() => rebuildSim()).domElement.title =
    "Random radial offset from the sphere surface (0 = exactly on surface)";
  nodesFolder
    .add(params, "pointSize", 0.01, 0.2, 0.005)
    .name("Point Size")
    .onChange(() => {
      nodeShader.material.size = params.pointSize;
    }).domElement.title = "Visual size of each node point";

  const motionFolder = gui.addFolder("Motion");
  motionFolder.add(params, "speedMultiplier", 0, 5, 0.1).name("Speed").domElement.title =
    "Global speed multiplier (0 = paused)";
  motionFolder
    .add(params, "angularSpeedMin", 0.01, 1, 0.01)
    .name("ω Min")
    .onChange(() => rebuildSim()).domElement.title = "Minimum angular velocity per node (rad/s)";
  motionFolder
    .add(params, "angularSpeedMax", 0.01, 2, 0.01)
    .name("ω Max")
    .onChange(() => rebuildSim()).domElement.title = "Maximum angular velocity per node (rad/s)";
  motionFolder
    .add(params, "forceGreatCircle")
    .name("Great Circle")
    .onChange(() => rebuildSim()).domElement.title =
    "Force all nodes to orbit along great circles (no axial tilt)";

  const edgesFolder = gui.addFolder("Edges");
  edgesFolder
    .add(params, "edgeAlgorithm", ["distance", "knn", "mst", "gabriel"])
    .name("Algorithm")
    .onChange(() => syncAlgorithmGui()).domElement.title =
    "Edge algorithm: distance (threshold), knn (k-nearest), mst (minimum spanning tree), gabriel (Gabriel graph)";
  const maxDistCtrl = edgesFolder.add(params, "edgeMaxDistance", 0.1, 2, 0.05).name("Max Distance");
  maxDistCtrl.domElement.title =
    "Connect nodes within this chord distance (distance algorithm only)";
  const knnKCtrl = edgesFolder.add(params, "knnK", 1, 15, 1).name("k-NN k");
  knnKCtrl.domElement.title =
    "Number of nearest neighbors to connect per node (knn algorithm only)";
  edgesFolder
    .add(params, "edgePathMode", ["straight", "geodesic"])
    .name("Edge Path").domElement.title =
    "Draw edges as straight lines or geodesic arcs along the sphere surface";
  edgesFolder.add(params, "geodesicSegments", 4, 24, 2).name("Arc Segments").domElement.title =
    "Number of subdivisions per geodesic arc (higher = smoother curves)";
  edgesFolder
    .add(params, "edgeOpacity", 0, 1, 0.01)
    .name("Opacity")
    .onChange(() => {
      lineMat.opacity = params.edgeOpacity;
    }).domElement.title = "Edge line opacity (0 = invisible, 1 = fully opaque)";

  function syncAlgorithmGui(): void {
    maxDistCtrl.show(params.edgeAlgorithm === "distance");
    knnKCtrl.show(params.edgeAlgorithm === "knn");
  }
  syncAlgorithmGui();

  // ── Visual (Phase 3) ──
  const visualFolder = gui.addFolder("Visual");
  visualFolder
    .add(params, "nodeShape", ["circle", "cross", "diamond", "hexagon"])
    .name("Node Shape")
    .onChange(() => {
      nodeShader.shapeUniform.value = shapeIndexMap[params.nodeShape];
    }).domElement.title = "SDF shape for node rendering";
  visualFolder
    .add(params, "nodeGlowIntensity", 0, 1, 0.05)
    .name("Node Glow")
    .onChange(() => {
      nodeShader.glowUniform.value = params.nodeGlowIntensity;
    }).domElement.title = "Glow intensity around nodes";

  const edgeStyleFolder = gui.addFolder("Edge Style");
  edgeStyleFolder
    .add(params, "edgeStyle", ["solid", "distance-fade", "pulse", "signal", "breathing"])
    .name("Style")
    .onChange(() => syncEdgeStyle()).domElement.title = "Edge rendering style";
  edgeStyleFolder.add(params, "pulseSpeed", 0.1, 5, 0.1).name("Pulse Speed").domElement.title =
    "Speed of pulse animation along edges";
  edgeStyleFolder.add(params, "signalSpeed", 0.1, 3, 0.1).name("Signal Speed").domElement.title =
    "Speed of signal packets traveling along edges";
  edgeStyleFolder
    .add(params, "breathingSpeed", 0.1, 2, 0.05)
    .name("Breath Speed").domElement.title = "Breathing animation speed (sine wave)";

  const bloomFolder = gui.addFolder("Bloom");
  bloomFolder
    .add(params, "bloomEnabled")
    .name("Enabled")
    .onChange(() => rebuildBloom()).domElement.title = "Toggle bloom post-processing";
  bloomFolder
    .add(params, "bloomStrength", 0, 2, 0.05)
    .name("Strength")
    .onChange(() => {
      bloomPipeline?.setStrength(params.bloomStrength);
    }).domElement.title = "Bloom intensity";
  bloomFolder
    .add(params, "bloomRadius", 0, 1, 0.05)
    .name("Radius")
    .onChange(() => {
      bloomPipeline?.setRadius(params.bloomRadius);
    }).domElement.title = "Bloom blur radius";
  bloomFolder
    .add(params, "bloomThreshold", 0, 1, 0.05)
    .name("Threshold")
    .onChange(() => {
      bloomPipeline?.setThreshold(params.bloomThreshold);
    }).domElement.title = "Luminance threshold for bloom";

  const gridFolder = gui.addFolder("Sphere");
  gridFolder
    .add(params, "sphereBaseMode", ["translucent", "opaque", "none"])
    .name("Base Mode")
    .onChange(() => {
      if (params.sphereBaseMode === "none") {
        sphereMesh.visible = false;
      } else {
        sphereMesh.visible = true;
        sphereMat.transparent = params.sphereBaseMode === "translucent";
        sphereMat.opacity = params.sphereBaseMode === "translucent" ? 0.6 : 1.0;
        sphereMat.needsUpdate = true;
      }
    }).domElement.title = "Base sphere display mode: translucent / opaque / none";
  gridFolder
    .addColor(params, "sphereBaseColor")
    .name("Base Color")
    .onChange(() => {
      sphereMat.color.set(params.sphereBaseColor);
    }).domElement.title = "Base sphere color";
  gridFolder
    .add(params, "sphereGridVisible")
    .name("Grid Visible")
    .onChange(() => {
      gridLines.visible = params.sphereGridVisible;
    }).domElement.title = "Show latitude/longitude grid overlay";
  gridFolder
    .add(params, "sphereGridOpacity", 0.01, 0.2, 0.01)
    .name("Grid Opacity")
    .onChange(() => {
      gridMat.opacity = params.sphereGridOpacity;
    }).domElement.title = "Grid line opacity";
  gridFolder
    .addColor(params, "sphereGridColor")
    .name("Grid Color")
    .onChange(() => {
      gridMat.color.set(params.sphereGridColor);
    }).domElement.title = "Grid line color";

  const colorsFolder = gui.addFolder("Colors");
  colorsFolder
    .addColor(params, "nodeColor")
    .name("Node")
    .onChange(() => {
      nodeShader.colorUniform.value.set(params.nodeColor);
      signalMat.color.set(params.nodeColor);
    }).domElement.title = "Color of the node points";
  colorsFolder
    .addColor(params, "edgeColor")
    .name("Edge")
    .onChange(() => {
      lineMat.color.set(params.edgeColor);
    }).domElement.title = "Color of the edge lines";
  colorsFolder
    .addColor(params, "backgroundColor")
    .name("Background")
    .onChange(() => {
      scene.background = new THREE.Color(params.backgroundColor);
    }).domElement.title = "Scene background color";

  syncEdgeStyle();

  // ── 公開 API ──
  return {
    update(delta: number): void {
      elapsed += delta;
      updateNodePositions(state, params, delta);

      // ノード位置の更新シグナル
      posAttr.needsUpdate = true;

      syncEdges();

      // エッジスタイルのアニメーション
      if (params.edgeStyle === "breathing") {
        lineMat.opacity = computeBreathingOpacity(
          params.edgeOpacity,
          elapsed,
          params.breathingSpeed,
        );
      } else if (params.edgeStyle === "pulse") {
        // パルス: 不透明度をフレームごとに時間ベースで変調
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * params.pulseSpeed * Math.PI * 2);
        lineMat.opacity =
          params.edgeOpacity * (params.pulseWidth + (1 - params.pulseWidth) * pulse);
      }

      updateSignalPackets();
    },
    render(): void {
      if (bloomPipeline) {
        bloomPipeline.pipeline.render();
      } else {
        renderer.render(scene, camera);
      }
    },
    dispose(): void {
      gui.destroy();
      bloomPipeline?.dispose();
      scene.remove(nodeSprite);
      scene.remove(edgeLines);
      scene.remove(signalPoints);
      scene.remove(sphereMesh);
      scene.remove(gridLines);
      nodeShader.material.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      signalGeo.dispose();
      signalMat.dispose();
      sphereMesh.geometry.dispose();
      sphereMat.dispose();
      gridGeo.dispose();
      gridMat.dispose();
    },
  };
}
