import * as THREE from "three";
import type { RendererContext } from "../../core";
import { createGui } from "../../core";
import { createNodeState, updateNodePositions, computeDistanceEdges } from "./simulation";
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
    const { pairs, count } = computeDistanceEdges(state, params.edgeMaxDistance);
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
    .onChange(() => rebuildSim());
  nodesFolder
    .add(params, "sphereRadius", 0.5, 5, 0.1)
    .name("Sphere Radius")
    .onChange(() => rebuildSim());
  nodesFolder
    .add(params, "surfaceEpsilon", 0, 0.1, 0.005)
    .name("ε Offset")
    .onChange(() => rebuildSim());
  nodesFolder
    .add(params, "pointSize", 0.01, 0.2, 0.005)
    .name("Point Size")
    .onChange(() => {
      pointsMat.size = params.pointSize;
    });

  const motionFolder = gui.addFolder("Motion");
  motionFolder.add(params, "speedMultiplier", 0, 5, 0.1).name("Speed");
  motionFolder
    .add(params, "angularSpeedMin", 0.01, 1, 0.01)
    .name("ω Min")
    .onChange(() => rebuildSim());
  motionFolder
    .add(params, "angularSpeedMax", 0.01, 2, 0.01)
    .name("ω Max")
    .onChange(() => rebuildSim());
  motionFolder
    .add(params, "forceGreatCircle")
    .name("Great Circle")
    .onChange(() => rebuildSim());

  const edgesFolder = gui.addFolder("Edges");
  edgesFolder.add(params, "edgeMaxDistance", 0.1, 2, 0.05).name("Max Distance");
  edgesFolder
    .add(params, "edgeOpacity", 0, 1, 0.01)
    .name("Opacity")
    .onChange(() => {
      lineMat.opacity = params.edgeOpacity;
    });

  const colorsFolder = gui.addFolder("Colors");
  colorsFolder
    .addColor(params, "nodeColor")
    .name("Node")
    .onChange(() => {
      pointsMat.color.set(params.nodeColor);
    });
  colorsFolder
    .addColor(params, "edgeColor")
    .name("Edge")
    .onChange(() => {
      lineMat.color.set(params.edgeColor);
    });
  colorsFolder
    .addColor(params, "backgroundColor")
    .name("Background")
    .onChange(() => {
      scene.background = new THREE.Color(params.backgroundColor);
    });

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
