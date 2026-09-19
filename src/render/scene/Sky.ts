import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  type Scene,
} from 'three/webgpu';

import { clamp01, lerp } from '@shared/math';
import { SEASONS } from '@sim/balance/seasons';
import type { Weather } from '@sim/types';

import { TINT, type PaletteUniforms } from '../materials/paletteMaterial.ts';

const SKY_WET = new Color(0x9fc2d4);
const SKY_DRY = new Color(0xd8d2b4);
const SKY_RAIN = new Color(0x7d96a6);
const FLASH_COLOUR = new Color(0xf2f6ff);
/** How long a lightning flash lingers. */
const FLASH_MS = 260;

/** Fog distances relative to the camera distance (see MapRig). */
const CAMERA_DISTANCE = 120;

/** How fast smoke and ash ease toward their targets, per second. */
const EASE_PER_SECOND = 0.8;

export interface Atmosphere {
  /** 0 clear, ~0.6 regional haze, 1 your own wildfire's smoke. */
  smoke: number;
  /** 0 clear, 1 ash falling. */
  ash: number;
}

export class Sky {
  private readonly fog: Fog;
  private readonly hemi: HemisphereLight;
  private readonly sun: DirectionalLight;
  private readonly ambient: AmbientLight;
  private readonly sky = new Color();
  private readonly tint = new Color();
  private smoke = 0;
  private ash = 0;
  private flashAt = -1;

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

  /** Current eased amounts, for tests and the HUD. */
  get amounts(): Atmosphere {
    return { smoke: this.smoke, ash: this.ash };
  }

  /** A bolt just landed: wash the whole sky white for a moment. */
  flash(nowMs: number): void {
    this.flashAt = nowMs;
  }

  update(
    weather: Weather,
    uniforms: PaletteUniforms,
    target: Atmosphere,
    dtSeconds: number,
    nowMs = 0,
  ): void {
    const step = clamp01(dtSeconds * EASE_PER_SECOND);

    this.smoke = lerp(this.smoke, target.smoke, step);
    this.ash = lerp(this.ash, target.ash, step);

    const season = Sky.seasonAmount(weather.dayOfYear);
    const rain = weather.rain;
    const murk = Math.max(this.smoke, this.ash);

    uniforms.season.value = season;

    // Ash reads grey, smoke amber; whichever is thicker leads the colour.
    const ashShare = this.smoke + this.ash > 0 ? this.ash / (this.smoke + this.ash) : 0;

    this.tint.copy(TINT.haze).lerp(TINT.ash, ashShare);
    uniforms.tintColor.value.copy(this.tint);
    uniforms.tintAmount.value = murk * 0.55;

    this.sky
      .copy(SKY_WET)
      .lerp(SKY_DRY, season)
      .lerp(SKY_RAIN, rain * 0.45)
      .lerp(this.tint, murk * 0.8);
    (this.scene.background as Color).copy(this.sky);
    this.fog.color.copy(this.sky);
    this.fog.near = lerp(CAMERA_DISTANCE + 40, CAMERA_DISTANCE - 30, murk);
    this.fog.far = lerp(CAMERA_DISTANCE + 200, CAMERA_DISTANCE + 20, murk);

    // Two quick pulses, the way a strike actually reads.
    const since = nowMs - this.flashAt;
    const flash =
      this.flashAt < 0 || since > FLASH_MS
        ? 0
        : Math.max(0, 1 - since / FLASH_MS) *
          (since < 60 || (since > 110 && since < 190) ? 1 : 0.25);

    this.sun.intensity = lerp(1.9, 1.1, rain * 0.6) * lerp(1, 0.3, murk) + flash * 2.4;
    this.hemi.intensity = lerp(1.05, 0.85, rain * 0.5) * lerp(1, 0.75, murk) + flash * 1.7;

    if (flash > 0) {
      this.sky.lerp(FLASH_COLOUR, flash * 0.75);
      (this.scene.background as Color).copy(this.sky);
      this.fog.color.copy(this.sky);
    }
  }

  dispose(): void {
    this.scene.remove(this.hemi, this.sun, this.ambient);
    this.hemi.dispose();
    this.sun.dispose();
    this.ambient.dispose();
  }
}
