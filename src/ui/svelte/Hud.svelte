<script lang="ts">
  import type { Snippet } from 'svelte';

  import { FIRE_LOCK_SPEED, SPEEDS, speedNeedsKopdes, TURBO_KOPDES_LEVEL } from '@app/timeControl';
  import type { ClimateRegime, SkyCondition } from '@sim/types';

  import { t } from '../../i18n/index.ts';
  import { formatDate, formatRp } from '../format.ts';
  import type { IconName } from '../icons.ts';

  import type { EventChip, Hud } from './hudState.svelte.ts';
  import Icon from './Icon.svelte';
  import Tooltip from './Tooltip.svelte';

  interface Props {
    hud: Hud;
  }

  const { hud }: Props = $props();

  /** 0..n-1, for drawing one pip per condition. */
  const pips = (n: number): number[] => [...Array(n).keys()];
  const ui = $derived(hud.ui);
  const v = $derived(hud.view);

  const REGIME_KEY: Record<ClimateRegime, string> = {
    normal: 'hud.regimeNormal',
    elNino: 'hud.regimeElNino',
    laNina: 'hud.regimeLaNina',
  };
  const SKY_KEY: Record<SkyCondition, string> = {
    clear: 'hud.skyClear',
    cloudy: 'hud.skyCloudy',
    rain: 'hud.skyRain',
    storm: 'hud.skyStorm',
  };
  const SKY_ICON: Record<SkyCondition, IconName> = {
    clear: 'sun',
    cloudy: 'haze',
    rain: 'rain',
    storm: 'rain',
  };
  const CHIP_TONE: Record<EventChip['tone'], string> = {
    fire: 'chip-fire',
    smoke: 'chip-smoke',
    ash: 'chip-ash',
    water: 'chip-water',
    dry: 'chip-dry',
    pest: 'chip-pest',
    econ: 'chip-econ',
  };
  /** Which icon a chip carries, by event id. */
  const CHIP_ICON: Record<string, IconName> = {
    wildfire: 'fire',
    haze: 'haze',
    ash: 'haze',
    flood: 'rain',
    drought: 'sun',
    plague: 'beetle',
    investigation: 'police-warning',
    ban: 'police-warning',
    insolvent: 'coin',
    millStrike: 'mill-strike',
  };

  interface TileSpec {
    icon: IconName;
    label: string;
    value?: string;
    tone?: 'plain' | 'gold' | 'danger';
    /** Pins a pinging ! to the tile: something needs the player now. */
    alert?: boolean;
    testId: string;
    title?: string | undefined;
    /** A quieter second line, for the regime under the sky. */
    note?: string;
  }

  /**
   * The bar grows with the event chips, so anything that hangs under it
   * (the controls card, the ISPO checklist, the year-end card) is told where
   * its bottom edge is rather than guessing a fixed offset.
   */
  let bar = $state<HTMLElement | null>(null);
  $effect(() => {
    const element = bar;
    if (!element) return;
    const hidden = ui.hidden;
    const publish = () => {
      const top = hidden ? 12 : element.getBoundingClientRect().bottom + 8;
      document.documentElement.style.setProperty('--panel-top', `${Math.round(top)}px`);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    window.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
    };
  });

  const cover = $derived(v ? Math.round(v.forestCover * 100) : 0);
  const inDebt = $derived(v ? v.cash < 0 : false);
  const fireOver = $derived(v ? v.wildfire || v.firePressure > v.fireThreshold : false);
  const firePct = $derived(v ? Math.min(100, (v.firePressure / v.fireThreshold) * 100) : 0);
  const fireHot = $derived(v ? v.firePressure > v.fireThreshold * 0.6 : false);
  const trendClass = $derived(
    !v ? '' : v.tbsTrend > 0 ? 'text-[#3faa4c]' : v.tbsTrend < 0 ? 'text-[#e04a3a]' : 'muted',
  );
</script>

{#snippet tile(spec: TileSpec, body?: Snippet)}
  <div
    class="hud-tile {spec.tone === 'gold'
      ? 'hud-tile-gold'
      : spec.tone === 'danger'
        ? 'hud-tile-danger'
        : ''}"
    data-testid={spec.testId}
    title={spec.title}
  >
    <Icon name={spec.icon} />
    <div>
      <div class="label">{spec.label}</div>
      <div class="hud-value">
        {#if body}{@render body()}{:else}{spec.value}{/if}
      </div>
      {#if spec.note}<div class="label">{spec.note}</div>{/if}
    </div>
    {#if spec.alert}<span class="ping" data-testid={`${spec.testId}-alert`}>!</span>{/if}
  </div>
{/snippet}

{#snippet gauge(pct: number, from: string, to: string, text: string)}
  <span class="flex items-center gap-2">
    <span class="gauge w-20"
      ><i style="width: {pct}%; --gauge-from: {from}; --gauge-to: {to}"></i></span
    >
    <span>{text}</span>
  </span>
{/snippet}

<div
  class="ui-slide chrome-right pointer-events-none absolute left-0 top-0 z-10 flex flex-col items-start gap-2 p-3"
  class:ui-hidden-top={ui.hidden}
  bind:this={bar}
>
  {#if v}
    {#snippet priceBody()}
      {formatRp(v.tbsPrice)}<span class="text-sm">/kg</span>
      <span class={trendClass}>{v.tbsTrend > 0 ? '▲' : v.tbsTrend < 0 ? '▼' : '▬'}</span>
    {/snippet}
    {#snippet forestBody()}
      <span class={cover < 25 ? 'text-[#b85e12]' : ''}>{cover}%</span>
    {/snippet}
    {#snippet attentionBody()}
      {@const a = v.attention ?? 0}
      {@render gauge(
        Math.min(100, a),
        a >= 70 ? '#ef6a58' : a >= 40 ? '#ffb03a' : '#cbbb9a',
        a >= 70 ? '#e04a3a' : a >= 40 ? '#f28b2b' : '#a08a5e',
        String(Math.round(a)),
      )}
    {/snippet}
    {#snippet fireBody()}
      {@render gauge(
        firePct,
        fireOver ? '#ef6a58' : fireHot ? '#ffb03a' : '#5fd06a',
        fireOver ? '#e04a3a' : fireHot ? '#f28b2b' : '#3faa4c',
        `${v.firePressure.toFixed(1)} / ${v.fireThreshold}`,
      )}
    {/snippet}

    <div
      class="card pointer-events-auto flex flex-col items-start gap-2 px-5 py-3"
      data-testid="hud"
    >
      <div class="flex flex-wrap items-center justify-start gap-2.5">
        {@render tile({
          icon: 'coin',
          label: inDebt ? t('hud.cashDebt') : t('hud.cash'),
          value: formatRp(v.cash),
          tone: inDebt ? 'danger' : 'gold',
          alert: inDebt,
          testId: 'hud-cash',
          title: inDebt ? t('hud.cashDebtTitle') : undefined,
        })}
        {@render tile({
          icon: 'calendar',
          label: t('hud.date'),
          value: formatDate(v.tick),
          testId: 'hud-date',
        })}
        {@render tile(
          {
            icon: 'tbs-fruit',
            label: t('hud.tbsPrice'),
            testId: 'hud-price',
            title: t('hud.tbsTitle'),
          },
          priceBody,
        )}
        {@render tile({
          icon: SKY_ICON[v.sky],
          label: t('hud.climate'),
          value: t(SKY_KEY[v.sky]),
          note: t(REGIME_KEY[v.regime]),
          testId: 'hud-regime',
        })}
        {@render tile(
          {
            icon: 'forest-cover',
            label: t('hud.forest'),
            testId: 'hud-forest',
            title: t('hud.forestTitle'),
          },
          forestBody,
        )}
        {#if v.inputIndex > 1.005}
          {@render tile({
            icon: 'coin',
            label: t('hud.inputs'),
            value: `×${v.inputIndex.toFixed(2)}`,
            testId: 'hud-inputs',
            title: t('hud.inputsTitle'),
          })}
        {/if}
        {#if v.attention !== null}
          {@render tile(
            {
              icon: 'eye-attention',
              label: t('hud.attention'),
              tone: v.attention >= 70 ? 'danger' : 'plain',
              alert: v.attention >= 70,
              testId: 'attention-gauge',
              title: t('hud.attentionTitle'),
            },
            attentionBody,
          )}
        {/if}
        {#if v.firePressure > 0.01 || v.wildfire}
          {@render tile(
            {
              icon: 'fire',
              label: v.wildfire ? t('hud.fireWildfire') : t('hud.fire'),
              tone: fireOver ? 'danger' : 'plain',
              alert: fireOver,
              testId: 'fire-gauge',
              title: t('hud.fireTitle'),
            },
            fireBody,
          )}
        {/if}
        {#if v.burningCount > 0}
          <span class="chip chip-fire" data-testid="burning-chip">
            <Icon name="fire" />
            {v.burningCount === 1
              ? t('hud.burningOne', { n: v.burningCount })
              : t('hud.burningMany', { n: v.burningCount })}
          </span>
        {/if}
        {#if v.wildfire}
          <span class="chip chip-pest" data-testid="wildfire-badge">{t('hud.wildfire')}</span>
        {/if}
      </div>

      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <div
            class="pill-muted flex items-center gap-1.5 p-1"
            role="group"
            aria-label={t('hud.speedGroup')}
          >
            <span class="label px-1.5">{t('hud.speed')}</span>
            {#each SPEEDS as speed (speed)}
              {@const shut = speedNeedsKopdes(speed, v.kopdesLevel)}
              <Tooltip text={shut ? t('hud.speedNeedsKopdes', { level: TURBO_KOPDES_LEVEL }) : ''}>
                <button
                  class="btn btn-sm {v.speed === speed ? 'btn-green' : 'btn-ghost'}"
                  disabled={shut || (v.locked && speed > FIRE_LOCK_SPEED)}
                  data-testid={`speed-${speed}`}
                  data-locked={shut ? 'kopdes' : undefined}
                  onclick={() => hud.handlers.setSpeed(speed)}
                >
                  {#if speed === 0}<Icon name="pause" />{/if}{#if shut}<Icon name="lock" />{/if}{t(
                    `hud.speed${speed}`,
                  )}
                </button>
              </Tooltip>
            {/each}
            {#if v.locked}
              <span class="chip chip-fire" title={t('hud.lockedTitle', { n: FIRE_LOCK_SPEED })}>
                <Icon name="fire" />
                {FIRE_LOCK_SPEED}×
              </span>
            {/if}
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          {#if v.ispoMet !== null}
            <!-- Three states, so progress reads without opening anything:
                 nothing met is neutral, some met is gold, all met is green
                 and waits on the Ministry's year-end check. -->
            {@const all = v.ispoMet >= v.ispoTotal}
            <button
              class="btn ispo {all ? 'btn-green' : v.ispoMet > 0 ? 'btn-gold' : 'btn-ghost'}"
              title={t('hud.ispoTitle')}
              data-testid="hud-ispo"
              data-state={all ? 'certified' : v.ispoMet > 0 ? 'progress' : 'none'}
              onclick={() => hud.handlers.openCertificate()}
            >
              <Icon name="certificate-ispo" />
              <span class="flex flex-col items-start leading-none">
                <span class="label !text-[0.58rem] {all ? '!text-white/80' : ''}">
                  {t('hud.ispoLabel')}
                </span>
                <span class="num text-sm font-extrabold">
                  {all ? t('hud.ispoCertified') : `${v.ispoMet}/${v.ispoTotal}`}
                </span>
              </span>
              <span class="flex items-center gap-1" aria-hidden="true">
                {#each pips(v.ispoTotal) as i (i)}
                  <i class="ispo-pip {i < v.ispoMet ? 'ispo-pip-met' : ''}"></i>
                {/each}
              </span>
              {#if all}
                <!-- The Ministry has not looked yet: the dot says so. -->
                <i class="ispo-dot"></i>
              {/if}
            </button>
          {/if}

          <button
            class="btn btn-ghost"
            title={t('hud.helpTitle')}
            aria-label={t('hud.helpAria')}
            data-testid="help-button"
            onclick={() => hud.handlers.openHelp()}
          >
            {t('hud.help')}
          </button>

          <button
            class="btn btn-coral uppercase"
            data-testid="menu-button"
            onclick={() => hud.handlers.openMenu()}
          >
            {t('hud.menu')}
          </button>

          <div class="label flex items-center gap-2">
            <span title={t('hud.estateTitle')}>{v.estateCode}</span>
            <span class="pill-muted px-1.5 py-0.5">{v.backend}</span>
            {#if v.saveError}
              <span class="text-[#e04a3a]" title={v.saveError}>{t('hud.saveFailed')}</span>
            {:else if v.saveNote}
              <span>{t('hud.saved')}</span>
            {/if}
          </div>
        </div>
      </div>
    </div>

    {#if v.events.length > 0}
      <div
        class="pointer-events-auto flex flex-wrap justify-start gap-1.5"
        data-testid="events-strip"
      >
        {#each v.events as chip (chip.id)}
          <span class="chip {CHIP_TONE[chip.tone]}" data-testid={`event-chip-${chip.id}`}>
            {#if CHIP_ICON[chip.id]}<Icon name={CHIP_ICON[chip.id]!} />{/if}
            {chip.label}{#if chip.daysLeft !== null}, <span class="num"
                >{t('hud.daysLeft', { n: chip.daysLeft })}</span
              >{/if}
          </span>
        {/each}
      </div>
    {/if}
  {/if}
</div>
