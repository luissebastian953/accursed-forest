import { Mesh, Scene, Vector3 } from 'three/webgpu';

import { MapRig } from '@render/camera/MapRig';
import { BoxBuilder } from '@render/geometry/boxBuilder';
import { createPaletteTexture } from '@render/materials/palette';
import { createPaletteMaterial } from '@render/materials/paletteMaterial';
import { Palette } from '@render/materials/paletteSlots';
import { MODELS, ModelKit } from '@render/models/index';
import { createRenderer } from '@render/Renderer';
import { Sky } from '@render/scene/Sky';

import { GameLoop } from './loop.ts';

const SPACING = 9;
const PER_ROW = 6;
const VARIANTS = 3;

export async function startGallery(root: HTMLElement): Promise<() => void> {
  root.style.position = 'relative';

  const handle = await createRenderer(root, {
    forceWebGL: new URLSearchParams(location.search).has('webgl'),
  });
  const scene = new Scene();
  const sky = new Sky(scene);
  const paletteTexture = createPaletteTexture();
  const { material, uniforms } = createPaletteMaterial(paletteTexture);

  const ids = Object.keys(MODELS) as (keyof typeof MODELS)[];
  const rows = Math.ceil(ids.length / PER_ROW);
  const builder = new BoxBuilder();
  const kit = new ModelKit(builder);
  const labels: { el: HTMLElement; at: Vector3 }[] = [];

  ids.forEach((id, index) => {
    const cx = (index % PER_ROW) * SPACING + SPACING / 2;
    const cz = Math.floor(index / PER_ROW) * SPACING + SPACING / 2;

    builder.addAABox(cx, -0.25, cz, SPACING - 1, 0.5, SPACING - 1, {
      side: Palette.Laterite,
      top: Palette.Grass,
    });

    for (let v = 0; v < VARIANTS; v++) {
      let n = (index + 1) * 7919 + v * 104729;
      const rand = (): number => (n = (n * 1103515245 + 12345) % 2147483648) / 2147483648;

      kit.at({ x: cx - 2.5 + v * 2.5, y: 0, z: cz + (v - 1) * 1.2, scale: 1, turn: v * 0.9 });
      MODELS[id].build(kit, rand);
    }

    const el = document.createElement('div');

    el.className =
      'pointer-events-none absolute -translate-x-1/2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white';
    el.textContent = MODELS[id].name;
    root.appendChild(el);
    labels.push({ el, at: new Vector3(cx + SPACING / 2 - 1, 0, cz + SPACING / 2 - 1) });
  });

  const mesh = new Mesh(builder.build(), material);

  scene.add(mesh);

  const width = PER_ROW * SPACING;
  const depth = rows * SPACING;
  const rig = new MapRig({
    domElement: handle.canvas,
    bounds: { minX: 0, maxX: width, minZ: 0, maxZ: depth },
    baseFrustum: 44,
  });

  rig.jumpTo(width / 2, depth / 2);

  const weather = {
    dayOfYear: 90,
    regime: 'normal' as const,
    rain: 0,
    sun: 1,
    sky: 'clear' as const,
    skyUntil: 0,
    naturalFires: [],
    dryStreak: 0,
    wetStreak: 0,
    activeEvents: [],
  };
  const projected = new Vector3();

  const resize = (): void => {
    const { width: w, height: h } = handle.resize();

    rig.setAspect(w / h);
  };
  const observer = new ResizeObserver(resize);

  observer.observe(root);
  resize();

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'q' || event.key === 'Q') rig.rotate(-1, performance.now());
    if (event.key === 'e' || event.key === 'E') rig.rotate(1, performance.now());
  };

  window.addEventListener('keydown', onKey);

  const loop = new GameLoop({
    ticksPerSecond: () => 0,
    tick: () => undefined,
    frame: (dt, nowMs) => {
      rig.update(dt, nowMs);
      sky.update(weather, uniforms, { smoke: 0, ash: 0 }, dt);

      const rect = handle.canvas.getBoundingClientRect();

      for (const label of labels) {
        projected.copy(label.at).project(rig.camera);
        label.el.style.left = `${((projected.x + 1) / 2) * rect.width}px`;
        label.el.style.top = `${((1 - projected.y) / 2) * rect.height}px`;
      }

      handle.render(scene, rig.camera);
    },
  });

  loop.start();

  return () => {
    loop.stop();
    window.removeEventListener('keydown', onKey);
    observer.disconnect();
    for (const label of labels) label.el.remove();
    mesh.geometry.dispose();
    sky.dispose();
    rig.dispose();
    material.dispose();
    paletteTexture.dispose();
    handle.dispose();
  };
}
