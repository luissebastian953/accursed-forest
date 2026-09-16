/**
 * The cartoon icon set (design kit): flat SVGs served from `public/icons`.
 * `icon('coin')` is a lit fragment; `iconUrl` is for CSS backgrounds.
 */

import { html, type TemplateResult } from 'lit-html';

export type IconName =
  | 'axe-chop'
  | 'beetle'
  | 'biome-forest-cleared'
  | 'biome-forest-wild'
  | 'biome-grassfield'
  | 'biome-hills'
  | 'biome-palm-planted'
  | 'biome-river'
  | 'biome-scrub'
  | 'calendar'
  | 'certificate-ispo'
  | 'close-x'
  | 'coin'
  | 'eye-attention'
  | 'fire'
  | 'forest-cover'
  | 'harvest-basket'
  | 'haze'
  | 'kopdes'
  | 'mill-strike'
  | 'news'
  | 'pause'
  | 'play'
  | 'police-warning'
  | 'rain'
  | 'shop-bibit'
  | 'shop-fertilizer'
  | 'shop-metarhizium'
  | 'shop-sanitation'
  | 'shop-sapling'
  | 'shop-trap'
  | 'shop-trichoderma'
  | 'sun'
  | 'tbs-fruit'
  | 'water-irrigate';

export function iconUrl(name: IconName): string {
  return `${import.meta.env.BASE_URL}icons/${name}.svg`;
}

export function icon(name: IconName, extraClass = ''): TemplateResult {
  return html`<img class=${`icon ${extraClass}`} src=${iconUrl(name)} alt="" aria-hidden="true" />`;
}
