<script lang="ts">
  import { t } from '../../../i18n/index.ts';
  import Icon from '../base/Icon.svelte';

  import type { MarqueeHandlers } from './marqueeState.svelte.ts';

  interface Props {
    handlers: MarqueeHandlers;
  }

  const { handlers }: Props = $props();
  const message = $derived(t('disclaimer.marquee'));
</script>

<div class="marquee absolute left-0 right-0 top-0 z-[60]" data-testid="disclaimer-marquee">
  <button
    class="marquee-btn"
    title={t('disclaimer.marqueeOpen')}
    aria-label={t('disclaimer.marqueeOpen')}
    onclick={() => handlers.open()}
  >
    <!-- The copy is laid down twice so the track can loop on a half turn with
         no gap; the pair is one decoration, and the label carries the words. -->
    <span class="marquee-track" aria-hidden="true">
      {#each [0, 1] as copy (copy)}
        <span class="marquee-item">
          <Icon name="reboisasi" class="h-4 w-4" />
          {message}
        </span>
      {/each}
    </span>
    <span class="sr-only">{message}</span>
  </button>
</div>
