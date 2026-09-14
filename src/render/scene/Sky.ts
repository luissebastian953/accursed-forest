/**
 * Sky, fog and lights driven by weather (§6.4). Built before anything else
 * because it carries the game's atmosphere.
 *
 * M1a: the season lerp and the rain darkening. Haze and ash tints wire in
 * with the event deck (M1e); the uniforms they need already exist.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  type Scene,
} from 'three/webgpu';

import { lerp } from '@shared/math';
import { SEASONS } from '@sim/balance/seasons';
import type { Weather } from '@sim/types';

import { TINT, type PaletteUniforms } from '../materials/paletteMaterial.ts';

const SKY_WET = new Color(0x9fc2d4);
const SKY_DRY = new Color(0xd8d2b4);
const SKY_RAIN = new Color(0x7d96a6);

/** Fog distances relative to the camera distance (see MapRig). */
const CAMERA_DISTANCE = 120;

export class Sky {
  private readonly fog: Fog;
  private readonly hemi: HemisphereLight;
  private readonly sun: DirectionalLight;
  private readonly ambient: AmbientLight;
  private readonly sky = new Color();

  constructor(private readonly scene: Scene) {
    this.fog = new Fog(SKY_WET.clone(), CAMERA_DISTANCE + 40, CAMERA_DISTANCE + 200);
    scene.fog = this.fog;
    scene.background = SKY_WET.clone();

    this.hemi = new HemisphereLight(0xbcd9e8, 0x6b4a30, 1.05);
    this.sun = new DirectionalLight(0xfff2d8, 1.9);
    this.sun.position.set(60, 90, 30);
    this.ambient = new AmbientLight(0xffffff, 0.18);
    scene.add(this.hemi, this.sun, this.ambient);
  }

  /**
   * 0 in the heart of the wet season, 1 in the heart of the dry season,
   * smooth across the year so the palette never snaps.
   */
  static seasonAmount(dayOfYear: number): number {
    // The wet season is centred ~45 days after it starts (Nov → mid-Dec/Jan).
    const wetCentre = (SEASONS.wetStartDay + 45) % SEASONS.daysPerYear;
    const phase = ((dayOfYear - wetCentre) / SEASONS.daysPerYear) * Math.PI * 2;
    return 0.5 - 0.5 * Math.cos(phase);
  }

  update(weather: Weather, uniforms: PaletteUniforms): void {
    const season = Sky.seasonAmount(weather.dayOfYear);
    const rain = weather.rain;
    const haze = 0; // §3.6 events, M1e

    uniforms.season.value = season;
    uniforms.tintAmount.value = haze * 0.55;
    uniforms.tintColor.value.copy(TINT.haze);

    this.sky
      .copy(SKY_WET)
      .lerp(SKY_DRY, season)
      .lerp(SKY_RAIN, rain * 0.45);
    (this.scene.background as Color).copy(this.sky);
    this.fog.color.copy(this.sky);
    this.fog.near = lerp(CAMERA_DISTANCE + 40, CAMERA_DISTANCE - 30, haze);
    this.fog.far = lerp(CAMERA_DISTANCE + 200, CAMERA_DISTANCE + 20, haze);

    this.sun.intensity = lerp(1.9, 1.1, rain * 0.6) * lerp(1, 0.3, haze);
    this.hemi.intensity = lerp(1.05, 0.85, rain * 0.5);
  }

  dispose(): void {
    this.scene.remove(this.hemi, this.sun, this.ambient);
    this.hemi.dispose();
    this.sun.dispose();
    this.ambient.dispose();
  }
}
