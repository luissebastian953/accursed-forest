import { WebGPURenderer, type Camera, type Scene } from 'three/webgpu';

export type Backend = 'webgpu' | 'webgl';

export interface RendererHandle {
  readonly renderer: WebGPURenderer;
  readonly canvas: HTMLCanvasElement;
  readonly backend: Backend;
  /** Match the canvas to its container. */
  resize(): { width: number; height: number };
  /** The best scale this display can use, which adaptive quality starts from. */
  readonly maxPixelRatio: number;
  /** Spend fewer pixels per frame when the machine cannot afford them. */
  setPixelRatio(ratio: number): void;
  render(scene: Scene, camera: Camera): void;
  dispose(): void;
}

export async function createRenderer(
  root: HTMLElement,
  options: { forceWebGL?: boolean } = {},
): Promise<RendererHandle> {
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: options.forceWebGL ?? false });

  await renderer.init();

  const maxPixelRatio = Math.min(window.devicePixelRatio, 2);

  renderer.setPixelRatio(maxPixelRatio);
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
    maxPixelRatio,
    setPixelRatio(ratio) {
      renderer.setPixelRatio(ratio);
      // The drawing buffer only changes size when the canvas is sized again.
      resize();
    },
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
