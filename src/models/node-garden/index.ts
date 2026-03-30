import * as THREE from "three";
import type { RendererContext } from "../../core";
import { createGui } from "../../core";
import { NodeGardenSimulation } from "./simulation";
import { NodeGardenParams, defaultParams } from "./params";

/**
 * Node Garden テーマ。
 * RendererContext を受け取り、シーンへの追加・GUI構築・アニメーションループを担当。
 */
export function setup(ctx: RendererContext): { update(delta: number): void; dispose(): void } {
  const { scene } = ctx;
  const params: NodeGardenParams = { ...defaultParams };
  let sim = new NodeGardenSimulation(params);

  // ── ノード (InstancedMesh) ──
  const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
  const nodeMat = new THREE.MeshStandardMaterial({ color: params.nodeColor });
  let instancedNodes = new THREE.InstancedMesh(sphereGeo, nodeMat, params.nodeCount);
  scene.add(instancedNodes);

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
  const _dummy = new THREE.Object3D();

  function syncInstances(): void {
    for (let i = 0; i < sim.nodeCount; i++) {
      _dummy.position.set(sim.positions[i * 3], sim.positions[i * 3 + 1], sim.positions[i * 3 + 2]);
      _dummy.scale.setScalar(params.nodeRadius);
      _dummy.updateMatrix();
      instancedNodes.setMatrixAt(i, _dummy.matrix);
    }
    instancedNodes.instanceMatrix.needsUpdate = true;
  }

  function syncEdges(): void {
    const { pairs, count } = sim.computeEdges();
    const verts = new Float32Array(count * 2 * 3);

    for (let e = 0; e < count; e++) {
      const a = pairs[e * 2];
      const b = pairs[e * 2 + 1];
      const o = e * 6;
      verts[o] = sim.positions[a * 3];
      verts[o + 1] = sim.positions[a * 3 + 1];
      verts[o + 2] = sim.positions[a * 3 + 2];
      verts[o + 3] = sim.positions[b * 3];
      verts[o + 4] = sim.positions[b * 3 + 1];
      verts[o + 5] = sim.positions[b * 3 + 2];
    }

    lineGeo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    lineGeo.setDrawRange(0, count * 2);
  }

  function rebuildSim(): void {
    scene.remove(instancedNodes);
    instancedNodes.dispose();
    sim = new NodeGardenSimulation(params);
    instancedNodes = new THREE.InstancedMesh(sphereGeo, nodeMat, params.nodeCount);
    scene.add(instancedNodes);
  }

  // ── GUI ──
  const gui = createGui("Node Garden");

  const nodesFolder = gui.addFolder("Nodes");
  nodesFolder
    .add(params, "nodeCount", 10, 500, 1)
    .name("Count")
    .onChange(() => rebuildSim());
  nodesFolder.add(params, "nodeRadius", 0.01, 0.5, 0.01).name("Radius");
  nodesFolder
    .add(params, "spread", 2, 30, 0.5)
    .name("Spread")
    .onChange(() => rebuildSim());

  const edgesFolder = gui.addFolder("Edges");
  edgesFolder.add(params, "edgeMaxDistance", 0.5, 10, 0.1).name("Max Distance");
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
      nodeMat.color.set(params.nodeColor);
    });
  colorsFolder
    .addColor(params, "edgeColor")
    .name("Edge")
    .onChange(() => {
      lineMat.color.set(params.edgeColor);
    });

  gui.add(params, "speed", 0, 5, 0.1).name("Speed");

  // ── 公開 API ──
  return {
    update(delta: number): void {
      sim.update(delta);
      syncInstances();
      syncEdges();
    },
    dispose(): void {
      gui.destroy();
      scene.remove(instancedNodes);
      scene.remove(edgeLines);
      instancedNodes.dispose();
      sphereGeo.dispose();
      nodeMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}
