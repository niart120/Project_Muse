import { RenderPipeline } from "three/webgpu";
import { pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import type * as THREE from "three";
import type * as ThreeWebGPU from "three/webgpu";

export interface BloomPipeline {
  pipeline: RenderPipeline;
  setStrength: (v: number) => void;
  setRadius: (v: number) => void;
  setThreshold: (v: number) => void;
  dispose: () => void;
}

/**
 * TSL ベースのブルームポストプロセスパイプラインを生成する。
 * RenderPipeline + pass() + BloomNode で構成。
 */
export function createBloomPipeline(
  renderer: ThreeWebGPU.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  strength: number,
  radius: number,
  threshold: number,
): BloomPipeline {
  const scenePass = pass(scene, camera);
  const scenePassColor = scenePass.getTextureNode("output");

  const bloomPass = bloom(scenePassColor, strength, radius, threshold);

  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = scenePassColor.add(bloomPass);

  return {
    pipeline,
    setStrength(v: number) {
      bloomPass.strength.value = v;
    },
    setRadius(v: number) {
      bloomPass.radius.value = v;
    },
    setThreshold(v: number) {
      bloomPass.threshold.value = v;
    },
    dispose() {
      pipeline.dispose();
    },
  };
}
