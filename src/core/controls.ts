import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { RendererContext } from "./renderer";

/**
 * OrbitControls を生成して返す。
 * ダンピング有効。
 */
export function createOrbitControls(ctx: RendererContext): OrbitControls {
  const controls = new OrbitControls(ctx.camera, ctx.renderer.domElement);
  controls.enableDamping = true;
  return controls;
}
