<script lang="ts">
  import Icon from './Icon.svelte';
  import type { WorkMarkers } from './workMarkersState.svelte.ts';

  interface Props {
    markers: WorkMarkers;
  }

  const { markers }: Props = $props();

  const RADIUS = 20;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
</script>

<div class="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
  {#each markers.items as m (m.id)}
    <div
      class="work-marker absolute left-0 top-0 flex flex-col items-center"
      style="transform: translate({m.x}px, {m.y}px) translate(-50%, -100%)"
      data-testid="work-marker"
      data-kind={m.kind}
    >
      <div class="relative h-12 w-12 drop-shadow-[0_3px_0_rgba(74,51,32,0.35)]">
        <svg class="h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r={RADIUS} fill="#fff6e0" stroke="#f2e0b0" stroke-width="5" />
          <circle
            cx="24"
            cy="24"
            r={RADIUS}
            fill="none"
            stroke={m.kind === 'burn' ? '#ff7a3a' : '#3faa4c'}
            stroke-width="5"
            stroke-linecap="round"
            stroke-dasharray={CIRCUMFERENCE}
            stroke-dashoffset={CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, m.progress)))}
          />
        </svg>
        <span class="absolute inset-0 flex items-center justify-center">
          <Icon name={m.kind === 'burn' ? 'fire' : 'axe-chop'} />
        </span>
      </div>
      <span class="pill-muted num -mt-1.5 px-1.5 py-0 text-[10px] font-extrabold">
        {Math.round(m.progress * 100)}%
      </span>
    </div>
  {/each}
</div>

<style>
  circle {
    transition: stroke-dashoffset 0.35s linear;
  }
</style>
