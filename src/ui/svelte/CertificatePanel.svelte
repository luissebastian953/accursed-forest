<script lang="ts">
  import type { IspoCondition, IspoConditionId } from '@sim/systems/endings';

  import { t } from '../../i18n/index.ts';
  import { formatPercent, formatRp } from '../format.ts';

  import type { CertificatePanel } from './certificateState.svelte.ts';
  import Icon from './Icon.svelte';

  interface Props {
    panel: CertificatePanel;
  }

  const { panel }: Props = $props();
  const state = $derived(panel.state);

  const LABEL_KEY: Record<IspoConditionId, string> = {
    profit: 'certificate.conditionProfit',
    hectares: 'certificate.conditionHectares',
    noBurn: 'certificate.conditionNoBurn',
    forest: 'certificate.conditionForest',
    kopdes: 'certificate.conditionKopdes',
  };

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

  const met = $derived(state.conditions?.filter((c) => c.met).length ?? 0);
</script>

{#if state.conditions}
  <div
    class="card absolute left-1/2 z-30 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 p-4"
    data-testid="certificate-panel"
    style="top: var(--panel-top, 7rem)"
  >
    <div class="mb-1 flex items-center justify-between">
      <div class="flex items-center gap-2 font-extrabold">
        <Icon name="certificate-ispo" />
        {t('certificate.title')}
        <span class="num">{met}/{state.conditions.length}</span>
      </div>
      <button
        class="btn btn-close"
        data-testid="certificate-close"
        onclick={() => panel.handlers.close()}
      >
        ✕
      </button>
    </div>
    <p class="muted mb-3 text-xs">{t('certificate.intro')}</p>
    <ul class="space-y-1.5 text-sm">
      {#each state.conditions as c (c.id)}
        <li class="flex items-start gap-2" data-testid={`certificate-condition-${c.id}`}>
          <span class={c.met ? 'font-extrabold text-[#3faa4c]' : 'muted'}>{c.met ? '✓' : '○'}</span>
          <span class="flex-1">
            <span class="font-bold">{t(LABEL_KEY[c.id])}</span>
            <span class="muted num block text-xs">{conditionValue(c)}</span>
          </span>
        </li>
      {/each}
    </ul>
    <p
      class="mt-3 text-center text-sm font-extrabold"
      style="color: var(--green-2)"
      data-testid="certificate-win-note"
    >
      {t('certificate.winNote')}
    </p>
  </div>
{/if}
