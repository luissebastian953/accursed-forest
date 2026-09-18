<!--
  The win condition, spelled out (design kit 7a). A gold band at the top, the
  five conditions as rows with a bar each, and a footer that says what meeting
  them is worth. Each row shows how far along it is, so a condition that is
  nearly met does not look the same as one that has not started.
-->
<script lang="ts">
  import type { IspoCondition, IspoConditionId } from '@sim/systems/endings';

  import { t } from '../../i18n/index.ts';
  import { formatPercent, formatRp } from '../format.ts';
  import type { IconName } from '../icons.ts';

  import type { CertificatePanel } from './certificateState.svelte.ts';
  import Icon from './Icon.svelte';

  interface Props {
    panel: CertificatePanel;
  }

  const { panel }: Props = $props();
  const view = $derived(panel.state.view);

  const LABEL_KEY: Record<IspoConditionId, string> = {
    profit: 'certificate.conditionProfit',
    hectares: 'certificate.conditionHectares',
    noBurn: 'certificate.conditionNoBurn',
    forest: 'certificate.conditionForest',
    kopdes: 'certificate.conditionKopdes',
  };

  /** One icon per condition, so a row is recognisable before it is read. */
  const ICON: Record<IspoConditionId, IconName> = {
    profit: 'coin',
    hectares: 'biome-palm-planted',
    noBurn: 'fire',
    forest: 'forest-cover',
    kopdes: 'kopdes',
  };

  /** Where each condition stands, as a share of its target. */
  function share(c: IspoCondition): number {
    if (c.met) return 1;
    if (c.target <= 0) return 0;
    return Math.max(0, Math.min(1, c.value / c.target));
  }

  function conditionValue(c: IspoCondition): string {
    switch (c.id) {
      case 'profit':
        return t('certificate.valueOf', { value: formatRp(c.value), target: formatRp(c.target) });
      case 'hectares':
        return t('certificate.hectaresOf', { value: c.value, target: c.target });
      case 'noBurn':
        return c.met
          ? t('certificate.yearsClean', { target: c.target })
          : t('certificate.yearsOf', { value: c.value.toFixed(1), target: c.target });
      case 'forest':
        return t('certificate.valueOf', {
          value: formatPercent(c.value),
          target: formatPercent(c.target),
        });
      case 'kopdes':
        return t('certificate.levelOf', { value: c.value, target: c.target });
    }
  }

  /**
   * The badge on the right. The clean-record condition is the one that passes
   * by waiting, so it says how much longer rather than "in progress".
   */
  function badge(c: IspoCondition): string {
    if (c.met) return t('certificate.met');
    if (c.id === 'noBurn') {
      const days = Math.ceil((c.target - c.value) * 360);
      return t('certificate.daysLeft', { days });
    }
    return t('certificate.inProgress');
  }

  const met = $derived(view?.conditions.filter((c) => c.met).length ?? 0);
</script>

{#if view}
  <div
    class="card absolute left-1/2 z-30 w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 overflow-hidden !p-0"
    data-testid="certificate-panel"
    style="top: var(--panel-top, 7rem)"
  >
    <!-- The band: what this is, and how to be rid of it. -->
    <div class="flex items-start gap-3 bg-[linear-gradient(180deg,#ffe9a8,#f6d572)] p-4">
      <span class="pill flex h-11 w-11 shrink-0 items-center justify-center !bg-[#fffaea]">
        <Icon name="certificate-ispo" class="!h-6 !w-6" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="label !text-[0.6rem] !text-[#9a7a26]">{t('certificate.kicker')}</div>
        <div class="text-lg font-extrabold leading-tight">{t('certificate.title')}</div>
        <p class="mt-0.5 text-xs leading-snug text-[#6b5526]">{t('certificate.intro')}</p>
      </div>
      <button
        class="btn btn-close shrink-0"
        aria-label={t('menu.close')}
        data-testid="certificate-close"
        onclick={() => panel.handlers.close()}
      >
        ✕
      </button>
    </div>

    <!-- How many, and when the Ministry next looks. -->
    <div class="flex items-center gap-3 px-4 py-2.5">
      <span class="num shrink-0 text-sm font-extrabold" data-testid="certificate-count">
        {t('certificate.metOf', { met, total: view.conditions.length })}
      </span>
      <span class="flex min-w-0 flex-1 gap-1" aria-hidden="true">
        {#each view.conditions as c (c.id)}
          <i
            class="h-2 flex-1 rounded-full"
            style="background: {c.met ? 'var(--green-2)' : 'var(--pill-muted)'}"
          ></i>
        {/each}
      </span>
      <span class="muted num shrink-0 text-xs" data-testid="certificate-next">
        {t('certificate.nextCheck', { days: view.daysToCheck })}
      </span>
    </div>

    <div class="max-h-[min(24rem,50vh)] overflow-y-auto px-4 pb-3">
      {#each view.conditions as c (c.id)}
        <div
          class="mb-1.5 rounded-2xl border-2 p-2.5"
          style="border-color: {c.met ? '#bfe3b4' : 'transparent'}; background: {c.met
            ? '#eef8e9'
            : 'var(--pill-muted)'}"
          data-testid={`certificate-condition-${c.id}`}
          data-met={c.met}
        >
          <div class="flex items-center gap-2.5">
            <span class="pill flex h-8 w-8 shrink-0 items-center justify-center !bg-[#fffaea]">
              <Icon name={ICON[c.id]} />
            </span>
            <div class="min-w-0 flex-1 text-sm font-extrabold">{t(LABEL_KEY[c.id])}</div>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-extrabold"
              style={c.met
                ? 'background: var(--green-2); color: #fff'
                : 'background: #ffe6cc; color: #a85c14'}
            >
              {badge(c)}
            </span>
          </div>
          <div class="mt-1.5 flex items-center gap-2">
            <span class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#e7dcc0]">
              <i
                class="block h-full rounded-full"
                style="width: {share(c) * 100}%; background: {c.met
                  ? 'var(--green-2)'
                  : 'var(--orange-2)'}"
              ></i>
            </span>
            <span class="muted num shrink-0 text-xs">{conditionValue(c)}</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="flex items-center justify-between gap-3 border-t-2 border-[#f2e0b0] px-4 py-3">
      <span class="flex items-center gap-2 text-sm font-extrabold" style="color: var(--green-2)">
        <Icon name="certificate-ispo" />
        {t('certificate.winNote')}
      </span>
      <button
        class="btn btn-green shrink-0 uppercase tracking-wide"
        data-testid="certificate-back"
        onclick={() => panel.handlers.close()}
      >
        {t('certificate.back')}
      </button>
    </div>
  </div>
{/if}
