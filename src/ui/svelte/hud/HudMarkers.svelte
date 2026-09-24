<script lang="ts">
  import HudMarker from './HudMarker.svelte';
  import type { HudMarkers } from './hudMarkersState.svelte.ts';

  interface Props {
    markers: HudMarkers;
  }

  const { markers }: Props = $props();
</script>

<!-- The layer itself lets clicks through; each pin takes its own. -->
<div class="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
  {#each markers.items as marker (marker.id)}
    <HudMarker
      kind={marker.kind}
      x={marker.x}
      y={marker.y}
      label={marker.label}
      detail={marker.detail}
      alert={marker.alert}
      eyebrow={marker.eyebrow}
      pinned={marker.pinned}
      onClick={() => markers.handlers.select(marker.block)}
    />
  {/each}
</div>
