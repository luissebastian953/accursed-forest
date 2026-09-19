import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model, type ModelKit } from '../kit.ts';

/** A pitched roof over a `w`×`d` footprint whose eaves sit at `y`. */
function roof(kit: ModelKit, y: number, w: number, d: number, slot: number, broken = false): void {
  const pitch = 0.55;
  const half = w / 2;
  const slope = half / Math.cos(pitch) + 0.15;
  kit.box(-half / 2, y, 0, slope, 0.12, d + 0.3, slot, { tiltZ: pitch, bottom: true });
  if (!broken) kit.box(half / 2, y, 0, slope, 0.12, d + 0.3, slot, { tiltZ: -pitch, bottom: true });
  else
    kit.box(half / 2, y - 0.25, d * 0.2, slope * 0.5, 0.12, d * 0.5, slot, {
      tiltZ: -1,
      bottom: true,
    });
}

export const stiltHouse: Model = {
  name: 'stilt house',
  radius: 1.5,
  build(kit, rand) {
    const w = between(rand, 1.5, 1.9);
    const d = between(rand, 1.2, 1.5);
    const raise = 0.55;
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1])
      for (const z of [-d / 2 + 0.1, d / 2 - 0.1])
        kit.box(x, 0, z, 0.1, raise, 0.1, Palette.HouseWood);
    kit.box(0, raise, 0, w, 0.9, d, rand() < 0.5 ? Palette.HouseWall : Palette.HouseWood);
    kit.box(0, raise + 0.1, d / 2, 0.3, 0.6, 0.04, Palette.Cave);
    kit.box(0, 0, d / 2 + 0.35, 0.4, 0.12, 0.5, Palette.HouseWood, { tiltX: -0.7 });
    roof(kit, raise + 0.95, w, d, rand() < 0.6 ? Palette.HouseRoof : Palette.Thatch);
  },
};

export const woodCabin: Model = {
  name: 'wood cabin',
  radius: 1.5,
  build(kit, rand) {
    const w = between(rand, 1.6, 2);
    const d = between(rand, 1.3, 1.6);
    // Log walls: alternate courses of light and dark timber.
    for (let i = 0; i < 4; i++) {
      kit.box(0, i * 0.22, 0, w, 0.22, d, i % 2 === 0 ? Palette.Log : Palette.HouseWood);
    }
    kit.box(-w * 0.2, 0, d / 2, 0.32, 0.6, 0.04, Palette.Cave);
    kit.box(w * 0.25, 0.4, d / 2, 0.3, 0.25, 0.04, Palette.FlowerYellow);
    kit.box(w / 2 - 0.25, 0.5, -d / 4, 0.25, 1.1, 0.25, Palette.Rock);
    roof(kit, 0.9, w, d, Palette.HouseWood);
    // A woodpile.
    kit.box(-w / 2 - 0.25, 0, 0, 0.3, 0.3, 0.8, Palette.Log);
  },
};

export const abandonedHouse: Model = {
  name: 'abandoned house',
  radius: 1.7,
  build(kit, rand) {
    const w = between(rand, 1.6, 1.9);
    const d = between(rand, 1.3, 1.5);
    // Three walls stand; one has fallen in.
    kit.box(0, 0, -d / 2 + 0.05, w, 0.9, 0.1, Palette.DeadWood);
    kit.box(-w / 2 + 0.05, 0, 0, 0.1, 0.8, d, Palette.DeadWood);
    kit.box(w / 2 - 0.05, 0, 0, 0.1, 0.55, d * 0.7, Palette.HouseWood);
    kit.box(0.1, 0, d / 2 + 0.3, w * 0.8, 0.1, 0.7, Palette.DeadWood, { turn: 0.15 });
    roof(kit, 0.9, w, d, Palette.Thatch, true);
    kit.box(-w * 0.2, 0, 0.2, 0.3, 0.5, 0.04, Palette.Cave);
    // The forest taking it back.
    kit.box(w / 2 - 0.1, 0, -d / 2, 0.5, 0.9, 0.5, Palette.Vine, { turn: rand() });
    kit.box(-w / 2, 0.8, 0, 0.12, 0.7, 0.4, Palette.Vine, { bottom: true });
  },
};
