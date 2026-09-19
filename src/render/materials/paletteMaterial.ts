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

/**
 * How hard a fully emissive slot lights itself. Enough that gold lands just
 * over the bloom threshold (1.1) and blooms in its own colour, not so much
 * that it burns out to white.
 */
const EMISSION_GAIN = 0.55;

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
  // The palette's alpha is an emission mask (see `palette.ts`). A slot that
  // carries one lights itself in its own colour, which puts gold over the
  // bloom threshold while leaving everything else exactly as it was.
  // `emissiveNode` is typed on the standard material only; every node material
  // honours it (NodeMaterial reads it when it sets up lighting).
  (material as unknown as { emissiveNode: unknown }).emissiveNode = tinted.mul(
    wet.a.mul(EMISSION_GAIN),
  );

  return { material, uniforms };
}
