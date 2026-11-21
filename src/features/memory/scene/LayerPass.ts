import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import type { SceneLayer } from "./memorySceneTypes";

export class LayerPass extends Pass {
  constructor(
    private readonly layers: ReadonlySet<SceneLayer>,
    private readonly container: HTMLElement,
    private readonly timeProvider: () => number,
    private readonly particleShareProvider: () => number,
  ) {
    super();
    this.needsSwap = false;
    this.clear = false;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    _write: THREE.WebGLRenderTarget,
    read: THREE.WebGLRenderTarget,
  ): void {
    if (this.layers.size === 0) return;
    const viewW = Math.max(1, this.container.clientWidth);
    const viewH = Math.max(1, this.container.clientHeight);
    const pixelScaling = read.width / viewW;
    const previousAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    for (const layer of this.layers) {
      const area = layer.rect();
      if (!area || area.width < 2 || area.height < 2) continue;

      layer.update(
        this.timeProvider(),
        area.width / area.height,
        pixelScaling,
        this.particleShareProvider(),
      );

      const x = Math.round(area.left * pixelScaling);
      const y = Math.round((viewH - area.top - area.height) * pixelScaling);
      const w = Math.round(area.width * pixelScaling);
      const h = Math.round(area.height * pixelScaling);

      read.viewport.set(x, y, w, h);
      read.scissor.set(x, y, w, h);
      read.scissorTest = true;

      renderer.setRenderTarget(this.renderToScreen ? null : read);
      renderer.clearDepth();
      renderer.render(layer.scene, layer.camera);
    }

    read.viewport.set(0, 0, read.width, read.height);
    read.scissor.set(0, 0, read.width, read.height);
    read.scissorTest = false;

    renderer.setRenderTarget(this.renderToScreen ? null : read);
    renderer.autoClear = previousAutoClear;
  }
}
