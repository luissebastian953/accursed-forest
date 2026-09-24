import { mount, unmount, type Component } from 'svelte';

import type { BlockId } from '@sim/types';

import HudMarkersView from './HudMarkers.svelte';

export type HudMarkerKind = 'workshop' | 'firstStep' | 'ganoderma' | 'beetle' | 'landslide';

/** The pin art and the colour its label pill borrows, by kind. */
export const MARKER_LOOK: Record<HudMarkerKind, { pin: string; ring: string }> = {
  workshop: { pin: `${import.meta.env.BASE_URL}hud/hud-pin-workshop.svg`, ring: '#7a6440' },
  firstStep: { pin: `${import.meta.env.BASE_URL}hud/hud-pin-workshop.svg`, ring: '#c94a30' },
  ganoderma: { pin: `${import.meta.env.BASE_URL}hud/hud-pin-ganoderma.svg`, ring: '#6b3a8a' },
  beetle: { pin: `${import.meta.env.BASE_URL}hud/hud-pin-beetle.svg`, ring: '#9e2e20' },
  landslide: { pin: `${import.meta.env.BASE_URL}hud/hud-pin-landslide.svg`, ring: '#9c4a24' },
};

export interface HudMarker {
  /** Stable per block and kind, so a marker is not rebuilt every frame. */
  id: string;
  kind: HudMarkerKind;
  block: BlockId;
  /** Screen position of the hectare's centre, in CSS pixels. */
  x: number;
  y: number;
  label: string;
  detail: string;
  alert: boolean;
  /** A caption over the label, and a card that stays open without the pointer. */
  eyebrow?: string;
  pinned?: boolean;
}

export interface HudMarkerHandlers {
  /** Clicking a pin selects its block, the way clicking the land does. */
  select(block: BlockId): void;
}

export class HudMarkers {
  items = $state.raw<HudMarker[]>([]);
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: HudMarkerHandlers,
  ) {
    this.target = document.createElement('div');
    parent.appendChild(this.target);
    this.instance = mount(HudMarkersView, { target: this.target, props: { markers: this } });
  }

  update(items: HudMarker[]): void {
    if (items.length === 0 && this.items.length === 0) return;
    this.items = items;
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
