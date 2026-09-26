<script lang="ts">
  import { CERTIFICATE_CONDITIONS } from '@sim/systems/endings';

  import { t } from '../../../i18n/index.ts';
  import { formatPercent, formatRp } from '../../format.ts';
  import Icon from '../base/Icon.svelte';

  import type { YearEndCard } from './certificateState.svelte.ts';

  interface Props {
    card: YearEndCard;
  }

  const { card }: Props = $props();
  const state = $derived(card.state);

  const coverDelta = $derived(
    state.view?.previous ? state.view.summary.forestCover - state.view.previous.forestCover : null,
  );

  const PIPS = Array.from({ length: CERTIFICATE_CONDITIONS }, (_, i) => i);
</script>

{#if state.view}
  {@const s = state.view.summary}
  {@const up = s.profit >= 0}
  {@const ink = up ? 'var(--green-edge)' : 'var(--red-edge)'}
  <div
    class="card absolute left-3 z-20 w-72 !p-0 text-sm"
    style="top: var(--panel-top, 7rem)"
    data-testid="year-end-card"
  >
    <div class="flex items-center gap-2.5 rounded-t-[16px] bg-[#2c2118] px-3 py-2.5 text-[#fff6e0]">
      <span class="year-chip relative flex h-11 w-11 shrink-0 flex-col items-center justify-center">
        <span class="label !text-[0.5rem] !leading-none !text-[#8a6a1f]">
          {t('certificate.yearChip')}
        </span>
        <span class="num text-lg leading-none">{s.year}</span>
      </span>
      <div class="min-w-0 flex-1">
        <div class="label !text-[0.58rem] !text-[#c9a44a]">{t('certificate.yearKicker')}</div>
        <div class="truncate text-base font-extrabold leading-tight">
          {t('certificate.yearClosed', { year: s.year })}
        </div>
      </div>
      <button
        class="btn btn-close shrink-0"
        aria-label={t('menu.close')}
        data-testid="year-end-dismiss"
        onclick={() => card.hide()}
      >
        ✕
      </button>
    </div>

    <div class="space-y-2 p-3">
      <div
        class="flex items-center gap-2.5 rounded-2xl border-2 p-2.5"
        style="border-color: {up ? '#bfe3b4' : '#f2c4bb'}; background: {up ? '#eef8e9' : '#fbeae7'}"
        data-testid="year-end-result"
        data-profit={up}
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2"
          style="background: {up ? 'var(--green-2)' : 'var(--red)'}; border-color: {ink}"
        >
          <Icon name={up ? 'arrow-up' : 'arrow-down'} class="!h-4 !w-4" />
        </span>
        <div class="min-w-0">
          <div class="label !text-[0.58rem]" style="color: {ink}">
            {up ? t('certificate.profit') : t('certificate.loss')}
          </div>
          <div class="num truncate text-lg leading-tight" style="color: {ink}">
            {formatRp(Math.abs(s.profit))}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="tile" data-testid="year-end-bearing">
          <div class="flex items-center gap-1.5">
            <Icon name="palm-fruit-bunch" class="!h-3.5 !w-3.5" />
            <span class="label !text-[0.56rem]">{t('certificate.bearing')}</span>
          </div>
          <div class="mt-1.5 flex items-baseline gap-1">
            <span class="num text-lg leading-none">{s.matureHectares}</span>
            <span class="label !text-[0.68rem] !normal-case">{t('certificate.unitHa')}</span>
          </div>
        </div>

        <div class="tile" data-testid="year-end-forest">
          <div class="flex items-center gap-1.5">
            <Icon name="forest-cover" class="!h-3.5 !w-3.5" />
            <span class="label !text-[0.56rem]">{t('certificate.forestCover')}</span>
          </div>
          <div class="mt-1.5 flex items-baseline gap-1">
            <span class="num text-lg leading-none">{formatPercent(s.forestCover)}</span>
            {#if coverDelta !== null && Math.abs(coverDelta) >= 0.005}
              <span
                class="num text-xs"
                style="color: {coverDelta > 0 ? 'var(--green-2)' : 'var(--orange-edge)'}"
              >
                {coverDelta > 0 ? '+' : '-'}{formatPercent(Math.abs(coverDelta))}
              </span>
            {/if}
          </div>
          <span class="mt-2 block h-2 overflow-hidden rounded-full bg-[#e7dcc0]">
            <i
              class="block h-full rounded-full"
              style="width: {Math.round(
                Math.max(0, Math.min(1, s.forestCover)) * 100,
              )}%; background: var(--green-2)"
            ></i>
          </span>
        </div>
      </div>

      {#if state.view.conditionsMet !== null}
        {@const met = state.view.conditionsMet}
        <div class="tile" data-testid="year-end-cert">
          <div class="flex items-center gap-1.5">
            <Icon name="certificate-palm" class="!h-3.5 !w-3.5" />
            <span class="label min-w-0 flex-1 truncate !text-[0.56rem]"
              >{t('certificate.cert')}</span
            >
            <span class="num shrink-0 text-xs">
              {t('certificate.metOf', { met, total: CERTIFICATE_CONDITIONS })}
            </span>
          </div>
          <span class="mt-2 flex gap-1" aria-hidden="true">
            {#each PIPS as i (i)}
              <i
                class="h-2 flex-1 rounded-full"
                style="background: {i < met ? 'var(--green-2)' : '#e7dcc0'}"
              ></i>
            {/each}
          </span>
        </div>
      {/if}

      <button
        class="btn btn-green btn-lg w-full"
        data-testid="year-end-continue"
        onclick={() => card.hide()}
      >
        {t('certificate.continueYear', { year: s.year + 1 })}
      </button>
    </div>
  </div>
{/if}

<style>
  .tile {
    border: 2px solid var(--card-edge);
    border-radius: 16px;
    background: #fffdf5;
    padding: 0.5rem 0.6rem;
  }

  .year-chip {
    border: 2px solid var(--gold-edge);
    border-radius: 14px;
    background: linear-gradient(180deg, var(--gold), var(--gold-2));
    color: var(--ink);
  }

  /* The halo the alert badges wear, in gold: a new year has started. */
  .year-chip::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    --ripple-hue: var(--gold-2);
    --ripple-range: 10px;
    animation: ripple 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .year-chip::after {
      animation: none;
    }
  }
</style>
