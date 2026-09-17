<!--
  One pin over a hectare (design kit 6a): the Kopdes workshop, or a block the
  pests have got into. The `kind` prop picks the pin and its colour; the label
  pill sits above it and only appears on hover, so a field of sick blocks does
  not bury the estate in text.
-->
<script lang="ts">
  import { MARKER_LOOK, type HudMarkerKind } from './hudMarkersState.svelte.ts';

  interface Props {
    kind: HudMarkerKind;
    /** Screen position of the hectare's centre, in CSS pixels. */
    x: number;
    y: number;
    label: string;
    detail: string;
    /** A pulsing "!" on the ring: this one wants doing something about. */
    alert?: boolean;
    onClick?: () => void;
  }

  const { kind, x, y, label, detail, alert = false, onClick }: Props = $props();
  const look = $derived(MARKER_LOOK[kind]);
</script>

<div
  class="hud-marker pointer-events-none absolute left-0 top-0 flex flex-col items-center"
  style="transform: translate({x}px, {y}px) translate(-50%, -100%)"
  data-testid="hud-marker"
  data-kind={kind}
>
  <div
    class="hud-marker-label pill mb-1 whitespace-nowrap border-[3px] px-2.5 py-1 text-center leading-tight"
    style="border-color: {look.ring}; background: var(--card)"
  >
    <div class="text-base font-extrabold" style="color: {look.ring}">{label}</div>
    <div class="label">{detail}</div>
  </div>

  <button
    class="pointer-events-auto relative block h-[60px] w-[48px] bg-transparent p-0"
    style="cursor: {onClick ? 'pointer' : 'default'}"
    aria-label={`${label}: ${detail}`}
    data-testid="hud-marker-pin"
    onclick={() => onClick?.()}
  >
    <img class="h-full w-full select-none" src={look.pin} alt="" />
    {#if alert}
      <span class="ping !-right-1 !-top-1 !h-4 !w-4 !text-[0.6rem]" data-testid="hud-marker-alert">
        !
      </span>
    {/if}
  </button>
</div>

<style>
  /* The pill is the pin's own tooltip: it shows when the pin is under the pointer. */
  .hud-marker-label {
    opacity: 0;
    transform: translateY(4px);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  .hud-marker:hover .hud-marker-label,
  .hud-marker:focus-within .hud-marker-label {
    opacity: 1;
    transform: translateY(0);
  }

  /* The pin being read comes to the front; its label is wider than the pin. */
  .hud-marker:hover,
  .hud-marker:focus-within {
    z-index: 2;
  }

  @media (prefers-reduced-motion: reduce) {
    .hud-marker-label {
      transition: none;
    }
  }
</style>
