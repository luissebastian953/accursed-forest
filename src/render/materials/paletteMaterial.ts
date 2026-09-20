import { attribute, mix, texture, uniform, vec2, vec4 } from 'three/tsl';
import { Color, MeshLambertNodeMaterial, type DataTexture } from 'three/webgpu';

/** Row centres in the 256x2 palette texture. */
const ROW_WET = 0.25;
const ROW_DRY = 0.75;

/** Inferred from the factory, not spelled out, so the TSL node types stay what three says. */
export type PaletteUniforms = ReturnType<typeof createPaletteUniforms>;

export interface PaletteMaterial {
  material: MeshLambertNodeMaterial;
  uniforms: PaletteUniforms;
}

/** Puts gold just over the bloom threshold (1.1) in its own colour, short of burning white. */
const EMISSION_GAIN = 0.55;

/** Event tints from GDD 6.1 / GDD 6.4. */
export const TINT = {
  none: new Color(0xffffff),
  haze: new Color(0xc9a06a),
  ash: new Color(0x9a9a9a),
} as const;

export function createPaletteUniforms() {
  return {
    /** 0 = wet season, 1 = dry season. */
    season: uniform(0),
    /** Colour an active event washes the world toward. */
    tintColor: uniform(TINT.haze.clone()),
    /** 0 = no event, 1 = fully washed out. */
    tintAmount: uniform(0),
  };
}

export function createPaletteMaterial(
  paletteTexture: DataTexture,
  uniforms: PaletteUniforms = createPaletteUniforms(),
): PaletteMaterial {
  const material = new MeshLambertNodeMaterial();

  material.flatShading = true;

  const u = attribute('paletteU', 'float');
  const wet = texture(paletteTexture, vec2(u, ROW_WET));
  const dry = texture(paletteTexture, vec2(u, ROW_DRY));

  const seasonal = mix(wet.rgb, dry.rgb, uniforms.season);
  const tinted = mix(seasonal, uniforms.tintColor, uniforms.tintAmount);

  material.colorNode = vec4(tinted, 1);
  // The palette's alpha is an emission mask (see `palette.ts`). The cast: `emissiveNode` is
  // typed on the standard material only, but every NodeMaterial reads it for lighting.
  (material as unknown as { emissiveNode: unknown }).emissiveNode = tinted.mul(
    wet.a.mul(EMISSION_GAIN),
  );

  return { material, uniforms };
}
