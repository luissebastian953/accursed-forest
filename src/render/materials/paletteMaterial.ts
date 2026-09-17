/**
 * The one material everything static shares (§6.4).
 *
 * `colorNode` samples the palette strip at the vertex's `paletteU`, lerping the
 * wet-season row against the dry-season row with a `season` uniform, then mixes
 * an event tint (haze amber-grey, ash grey) on top. Two floats shift the mood of
 * the entire world.
 *
 * Lambert, flat-shaded, no specular; §6.1.
 */

import { attribute, mix, texture, uniform, vec2, vec4 } from 'three/tsl';
import { Color, MeshLambertNodeMaterial, type DataTexture } from 'three/webgpu';

/** Row centres in the 256x2 palette texture. */
const ROW_WET = 0.25;
const ROW_DRY = 0.75;

/**
 * `season` lerps the wet row against the dry row; `tintColor`/`tintAmount` wash
 * the result toward an event colour. Inferred from the factory rather than
 * spelled out, so the TSL node types stay whatever three says they are.
 */
export type PaletteUniforms = ReturnType<typeof createPaletteUniforms>;

export interface PaletteMaterial {
  material: MeshLambertNodeMaterial;
  uniforms: PaletteUniforms;
}

/** Event tints from §6.1 / §6.4. */
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

  return { material, uniforms };
}
