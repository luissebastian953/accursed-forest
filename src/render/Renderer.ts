/**
 * Renderer setup (§6.4): WebGPU with automatic WebGL 2 fallback, and a
 * `forceWebGL` switch so CI exercises the fallback path on purpose.
 */

import { WebGPURenderer, type Camera, type Scene } from 'three/webgpu';

export type Backend = 'webgpu' | 'webgl';

export interface RendererHandle {
  readonly renderer: WebGPURenderer;
  readonly canvas: HTMLCanvasElement;
  readonly backend: Backend;
  /** Match the canvas to its container. */
  resize(): { width: number; height: number };
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
}

export async function createRenderer(
  root: HTMLElement,
  options: { forceWebGL?: boolean } = {},
): Promise<RendererHandle> {
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: options.forceWebGL ?? false });
  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const backendFlags = renderer.backend as unknown as { isWebGPUBackend?: boolean };
  const backend: Backend = backendFlags.isWebGPUBackend ? 'webgpu' : 'webgl';

  const resize = (): { width: number; height: number } => {
    const width = root.clientWidth || window.innerWidth;
    const height = root.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    return { width, height };
  };
  resize();

  return {
    renderer,
    canvas: renderer.domElement,
    backend,
    resize,
    // `init()` has resolved, so the synchronous `render` is the right call.
    render: (scene, camera) => {
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
