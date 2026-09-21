import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import { RenderPipeline, type Camera, type Scene, type WebGPURenderer } from 'three/webgpu';

export const GLOW = {
  strength: 0.6,
  radius: 0.35,
  /** Luminance above which a pixel blooms. Sunlit sand stays under it; flames sit far over. */
  threshold: 0.7,
} as const;

export class Glow {
  private readonly pipeline: RenderPipeline;

  constructor(renderer: WebGPURenderer, scene: Scene, camera: Camera) {
    const scenePass = pass(scene, camera);
    const colour = scenePass.getTextureNode('output');

    this.pipeline = new RenderPipeline(renderer);
    this.pipeline.outputNode = colour.add(
      bloom(colour, GLOW.strength, GLOW.radius, GLOW.threshold),
    );
  }

  render(): void {
    this.pipeline.render();
  }

  /**
   * Compile the bloom shaders while the boot shell still covers the canvas.
   * Left alone they compile on the first flame, which is the worst moment.
   */
  async warm(): Promise<void> {
    await this.pipeline.renderAsync?.();
  }

  dispose(): void {
    this.pipeline.dispose();
  }
}
