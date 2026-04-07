import * as THREE from "three";
import * as ThreeWebGPU from "three/webgpu";

export interface RendererContext {
  renderer: ThreeWebGPU.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

/**
 * WebGPURenderer・シーン・カメラを初期化して返す。
 * WebGPU 非対応ブラウザでは自動的に WebGL2 にフォールバック。
 */
export function createRendererContext(): RendererContext {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 8, 18);

  const renderer = new ThreeWebGPU.WebGPURenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 基本ライティング (Points では未使用だが将来のメッシュ追加に備え残す)
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
  dirLight.position.set(10, 15, 10);
  scene.add(dirLight);

  return { renderer, scene, camera };
}
