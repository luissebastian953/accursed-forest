<script lang="ts">
  import { t } from '../../../i18n/index.ts';
  import { LANE_TONE } from '../../newsLane.ts';
  import Icon from '../base/Icon.svelte';

  import { tickerState, type TickerHandlers } from './newsTickerState.svelte.ts';

  interface Props {
    handlers: TickerHandlers;
  }

  const { handlers }: Props = $props();
  const state = tickerState();
</script>

<div
  class="ui-slide chrome-right pointer-events-none absolute bottom-0 left-0 z-10 flex justify-center px-[30px] py-2"
  class:ui-hidden-bottom={state.hidden}
>
  <button
    class="card pointer-events-auto flex w-full items-center gap-2.5 overflow-hidden px-3 py-1.5 text-left text-xs hover:brightness-[1.03]"
    data-testid="news-ticker"
    onclick={() => handlers.open()}
  >
    <!-- One badge: the word and the count read as a single thing to press,
         where two chips side by side read as two. -->
    <span class="chip chip-coral shrink-0">
      <Icon name="news" />
      {t('newsTicker.badge')}
      {#if state.unread > 0}
        <span
          class="num ml-0.5 rounded-full bg-white px-1.5 text-[0.72rem] text-[var(--coral-edge)]"
          data-testid="news-unread">{state.unread}</span
        >
      {/if}
    </span>
    {#each state.items as item, i (item.tick + item.title)}
      <span class="flex min-w-0 items-center gap-1.5 {i > 0 ? 'hidden md:flex' : ''}">
        <span class="h-2 w-2 shrink-0 rounded-full {LANE_TONE[item.lane]}"></span>
        <span class="truncate" data-testid={item.testId}>{item.title}</span>
      </span>
    {:else}
      <span class="muted truncate" data-testid="news-ticker-empty">{t('newsTicker.empty')}</span>
    {/each}
  </button>
</div>
