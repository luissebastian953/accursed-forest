<script lang="ts">
  import { t } from '../../../i18n/index.ts';
  import { formatDate } from '../../format.ts';
  import { LANE_LABEL_KEY, LANE_TONE } from '../../newsLane.ts';
  import Phone from '../base/Phone.svelte';
  import PhoneHeader from '../base/PhoneHeader.svelte';

  import { type NewsFilter, type NewsPanel } from './newsPanelState.svelte.ts';

  interface Props {
    panel: NewsPanel;
  }

  const { panel }: Props = $props();
  const ui = $derived(panel.ui);

  const FILTERS: { id: NewsFilter; key: string }[] = [
    { id: 'all', key: 'news.filterAll' },
    { id: 'natural', key: 'news.filterNatural' },
    { id: 'economic', key: 'news.filterEconomic' },
    { id: 'government', key: 'news.filterGovernment' },
  ];

  const items = $derived(
    [...panel.feed.news].reverse().filter((n) => ui.filter === 'all' || n.lane === ui.filter),
  );
</script>

{#if ui.open}
  <Phone testId="news-panel" tick={panel.feed.status.tick}>
    {#snippet header()}
      <PhoneHeader
        tile="news"
        title={t('news.title')}
        closeTestId="news-close"
        onClose={() => panel.handlers.close()}
      >
        {#snippet extra()}
          {#if panel.feed.status.unread > 0}
            <span
              class="chip chip-pest num shrink-0 !py-0.5 text-xs"
              data-testid="news-unread-badge"
            >
              {t('news.newCount', { n: panel.feed.status.unread })}
            </span>
          {/if}
        {/snippet}
      </PhoneHeader>
      <div
        class="grid grid-cols-4 gap-1.5 border-b-2 border-[var(--card-edge)] px-[6%] pb-3 text-xs"
      >
        {#each FILTERS as f (f.id)}
          <button
            class="btn btn-sm min-w-0 truncate !px-1 {ui.filter === f.id
              ? 'btn-green'
              : 'btn-ghost'}"
            data-testid={`news-filter-${f.id}`}
            onclick={() => (ui.filter = f.id)}
          >
            {t(f.key)}
          </button>
        {/each}
      </div>
    {/snippet}

    <ol data-testid="news-list">
      {#if items.length === 0}
        <li class="muted p-3 text-xs">{t('news.empty')}</li>
      {:else}
        {#each items as item (item.tick + item.title)}
          {@const first = item.blocks?.[0]}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
          <li
            class="mb-2 rounded-2xl border-2 border-[var(--card-edge)] bg-[var(--pill-muted)] p-3 {first !==
            undefined
              ? 'cursor-pointer hover:brightness-[1.03]'
              : ''}"
            data-testid="news-item"
            onclick={() => {
              if (first !== undefined) panel.handlers.focus(first);
            }}
          >
            <div class="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span
                class="rounded-full px-2 py-px font-extrabold text-white {LANE_TONE[item.lane]}"
              >
                {t(LANE_LABEL_KEY[item.lane])}
              </span>
              <span class="num muted font-bold">{formatDate(item.tick)}</span>
              {#if item.severity === 'critical'}
                <span class="rounded-full bg-[#ffd9d4] px-2 py-px font-extrabold text-[#9e2e20]">
                  ⚠ {t('news.severityCritical')}
                </span>
              {:else if item.severity === 'warning'}
                <span class="rounded-full bg-[#ffe6c8] px-2 py-px font-extrabold text-[#b85e12]">
                  ⚠ {t('news.severityWarning')}
                </span>
              {/if}
            </div>
            <div class="text-base font-extrabold leading-snug">{item.title}</div>
            <div class="muted mt-1 text-xs leading-snug">{item.body}</div>
            {#if item.effects.length > 0}
              <div
                class="mt-2 rounded-xl bg-[var(--card)] px-3 py-1.5 text-xs font-extrabold text-[#b85e12]"
              >
                → {item.effects.join(', ')}
              </div>
            {/if}
          </li>
        {/each}
      {/if}
    </ol>

    {#snippet footer()}
      <button
        class="btn btn-ghost w-full"
        data-testid="news-mark-read"
        onclick={() => panel.handlers.markRead()}
      >
        {t('news.markRead')}
      </button>
    {/snippet}
  </Phone>
{/if}
