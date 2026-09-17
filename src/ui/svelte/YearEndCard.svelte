<script lang="ts">
  import { t } from '../../i18n/index.ts';
  import { formatPercent, formatRp } from '../format.ts';

  import type { YearEndCard } from './certificateState.svelte.ts';

  interface Props {
    card: YearEndCard;
  }

  const { card }: Props = $props();
  const state = $derived(card.state);

  const coverDelta = $derived(
    state.view?.previous ? state.view.summary.forestCover - state.view.previous.forestCover : null,
  );
</script>

{#if state.view}
  {@const s = state.view.summary}
  <div
    class="card absolute right-3 z-20 w-64 p-4 text-sm"
    style="top: var(--panel-top, 7rem)"
    data-testid="year-end-card"
  >
    <div class="mb-2 flex items-center justify-between">
      <div class="font-extrabold">{t('certificate.yearClosed', { year: s.year })}</div>
      <button class="btn btn-close" data-testid="year-end-dismiss" onclick={() => card.hide()}
        >✕</button
      >
    </div>
    <dl class="grid grid-cols-2 gap-y-1">
      <dt class="label">{s.profit >= 0 ? t('certificate.profit') : t('certificate.loss')}</dt>
      <dd class={`text-right tabular-nums ${s.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
        {formatRp(Math.abs(s.profit))}
      </dd>
      <dt class="label">{t('certificate.bearing')}</dt>
      <dd class="num text-right">{t('certificate.hectares', { n: s.matureHectares })}</dd>
      <dt class="label">{t('certificate.forestCover')}</dt>
      <dd class="num text-right">
        {formatPercent(s.forestCover)}{#if coverDelta !== null && Math.abs(coverDelta) >= 0.005}
          <span class={coverDelta > 0 ? 'text-[#3faa4c]' : 'text-[#b85e12]'}>
            {coverDelta > 0 ? '+' : '-'}{formatPercent(Math.abs(coverDelta))}
          </span>
        {/if}
      </dd>
      {#if state.view.conditionsMet !== null}
        <dt class="label">{t('certificate.ispo')}</dt>
        <dd class="num text-right">{state.view.conditionsMet}/5</dd>
      {/if}
    </dl>
  </div>
{/if}
