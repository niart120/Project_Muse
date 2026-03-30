import * as THREE from "three";
import { createRendererContext, createOrbitControls } from "./core";
import { setup as setupNodeGarden } from "./models/node-garden";

// ── 初期化 ──
const ctx = createRendererContext();
const controls = createOrbitControls(ctx);

// ── テーマ起動 ──
const theme = setupNodeGarden(ctx);

// ── レンダーループ ──
const clock = new THREE.Clock();

async function init(): Promise<void> {
  await ctx.renderer.init();
  ctx.renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    theme.update(delta);
    controls.update();
    ctx.renderer.render(ctx.scene, ctx.camera);
  });
}

init();
