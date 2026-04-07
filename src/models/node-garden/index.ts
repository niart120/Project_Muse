import * as THREE from "three";
import type { RendererContext } from "../../core";
import { createGui } from "../../core";
import { createNodeState, updateNodePositions } from "./simulation";
import { edgeStrategies, geodesicArc } from "./edges";
import type { NodeGardenParams } from "./params";
import type { NodeState } from "./simulation";
import { defaultParams } from "./params";

export function setup(ctx: RendererContext): { update(delta: number): void; dispose(): void } {
  const { scene } = ctx;
  const params: NodeGardenParams = { ...defaultParams };
  let state: NodeState = createNodeState(params);

  // ── 背景 ──
  scene.background = new THREE.Color(params.backgroundColor);

  // ── ノード (Points) ──
  let pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute("position", new THREE.BufferAttribute(state.positions, 3));
  const pointsMat = new THREE.PointsMaterial({
    color: params.nodeColor,
    size: params.pointSize,
    sizeAttenuation: true,
  });
  let points = new THREE.Points(pointsGeo, pointsMat);
  scene.add(points);

  // ── エッジ (LineSegments) ──
  const lineGeo = new THREE.BufferGeometry();
  const lineMat = new THREE.LineBasicMaterial({
    color: params.edgeColor,
    transparent: true,
    opacity: params.edgeOpacity,
  });
  const edgeLines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(edgeLines);

  // ── ヘルパー ──
  function syncEdges(): void {
    const strategy = edgeStrategies[params.edgeAlgorithm];
    const { pairs, count } = strategy(state, params);

    if (params.edgePathMode === "geodesic") {
      // 測地線弧モード: 各エッジを弧で補間
      const segs = params.geodesicSegments;
      const vertsPerEdge = (segs + 1) * 2 - 2; // 線分セグメント数 × 2 頂点
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
        // LineSegments: 各セグメント [p_i, p_{i+1}]
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
      // 直線モード
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
  }

  function rebuildSim(): void {
    state = createNodeState(params);

    scene.remove(points);
    pointsGeo.dispose();
    pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(state.positions, 3));
    points = new THREE.Points(pointsGeo, pointsMat);
    scene.add(points);
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
      pointsMat.size = params.pointSize;
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

  const colorsFolder = gui.addFolder("Colors");
  colorsFolder
    .addColor(params, "nodeColor")
    .name("Node")
    .onChange(() => {
      pointsMat.color.set(params.nodeColor);
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

  // ── 公開 API ──
  return {
    update(delta: number): void {
      updateNodePositions(state, params, delta);
      pointsGeo.attributes.position.needsUpdate = true;
      syncEdges();
    },
    dispose(): void {
      gui.destroy();
      scene.remove(points);
      scene.remove(edgeLines);
      pointsGeo.dispose();
      pointsMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}
