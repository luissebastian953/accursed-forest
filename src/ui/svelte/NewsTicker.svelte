<script lang="ts">
  import { t } from '../../i18n/index.ts';
  import { LANE_TONE } from '../newsLane.ts';

  import Icon from './Icon.svelte';
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
  {#if state.items.length > 0}
    <button
      class="card pointer-events-auto flex w-full items-center gap-2.5 overflow-hidden px-3 py-1.5 text-left text-xs hover:brightness-[1.03]"
      data-testid="news-ticker"
      onclick={() => handlers.open()}
    >
      <span class="chip chip-cream shrink-0"><Icon name="news" /> {t('newsTicker.badge')}</span>
      {#if state.unread > 0}
        <span class="chip chip-pest num shrink-0" data-testid="news-unread">{state.unread}</span>
      {/if}
      {#each state.items as item, i (item.tick + item.title)}
        <span class="flex min-w-0 items-center gap-1.5 {i > 0 ? 'hidden md:flex' : ''}">
          <span class="h-2 w-2 shrink-0 rounded-full {LANE_TONE[item.lane]}"></span>
          <span class="truncate" data-testid={item.testId}>{item.title}</span>
        </span>
      {/each}
    </button>
  {/if}
</div>
