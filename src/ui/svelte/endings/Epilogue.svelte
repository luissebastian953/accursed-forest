<script lang="ts">
  import type { Snippet } from 'svelte';

  import { REBOISASI } from '@sim/balance/endings';
  import { GROWTH } from '@sim/balance/growth';
  import type { ChronicleEntry } from '@sim/types';

  import { t } from '../../../i18n/index.ts';
  import { formatDate, formatPercent, formatRp } from '../../format.ts';
  import type { IconName } from '../../icons.ts';
  import Icon from '../base/Icon.svelte';

  import { LOOK, type Epilogue, type EpilogueView } from './epilogueState.svelte.ts';

  interface Props {
    epilogue: Epilogue;
  }

  const { epilogue }: Props = $props();
  const ui = $derived(epilogue.ui);
  const v = $derived(epilogue.view);

  /** A tile's tint: the numbers that explain the ending get a colour. */
  type Tone = 'plain' | 'good' | 'warn' | 'bad';

  interface Stat {
    label: string;
    value: string;
    tone?: Tone;
  }

  const TONE_CLASS: Record<Tone, string> = {
    plain: 'bg-[var(--pill)] border-transparent',
    good: 'bg-[#e4f6dc] border-[var(--green)] text-[#2f7a2b]',
    warn: 'bg-[#ffe6c8] border-[var(--orange)] text-[#b85e12]',
    bad: 'bg-[#ffdcd6] border-[var(--coral)] text-[#9e2e20]',
  };

  const LANE_DOT: Record<ChronicleEntry['lane'], string> = {
    natural: 'bg-[var(--green-2)]',
    economic: 'bg-[var(--blue)]',
    government: 'bg-[var(--orange-2)]',
    estate: 'bg-[var(--ink-2)]',
  };

  function yearsOf(view: EpilogueView): number {
    return Math.max(1, Math.ceil(view.endedAt / GROWTH.daysPerYear));
  }

  function stats(view: EpilogueView): Stat[] {
    const s = view.stats;
    const years = String(yearsOf(view));
    const lastThree = view.years.slice(-3).reduce((sum, y) => sum + y.profit, 0);
    const count = (n: number) => n.toLocaleString('en');
    const ha = (n: number) => t('epilogue.ha', { n });
    const profit = (value: number): Stat => ({
      label: t('epilogue.statProfit'),
      value: formatRp(value),
      tone: value >= 0 ? 'good' : 'bad',
    });
    const burned: Stat = {
      label: t('epilogue.statHectaresBurned'),
      value: String(s.blocksBurned),
      tone: s.blocksBurned > 0 ? 'warn' : 'plain',
    };
    const settled = (label: string): Stat => ({
      label,
      value: s.settled > 0 ? formatRp(s.settled) : t('epilogue.none'),
      tone: s.settled > 0 ? 'warn' : 'plain',
    });

    switch (view.ending) {
      case 'clean':
        return [
          { label: t('epilogue.statYears'), value: years },
          {
            label: t('epilogue.statForestCover'),
            value: formatPercent(view.forestCover),
            tone: 'good',
          },
          { label: t('epilogue.statForestPlanted'), value: ha(s.forestPlanted) },
          { label: t('epilogue.statDisasters'), value: String(s.disasters) },
          { label: t('epilogue.statPalmsLost'), value: count(s.palmsLost) },
          profit(view.profitTotal),
        ];
      case 'dirty':
        return [
          { label: t('epilogue.statYears'), value: years },
          burned,
          {
            label: t('epilogue.statNeighboursBurned'),
            value: ha(s.neighbourBlocksBurned),
            tone: s.neighbourBlocksBurned > 0 ? 'warn' : 'plain',
          },
          { label: t('epilogue.statForestChopped'), value: ha(s.forestChopped) },
          settled(t('epilogue.statFinesNeverPaid')),
          profit(view.profitTotal),
        ];
      case 'redemption':
        return [
          { label: t('epilogue.statYears'), value: years },
          {
            label: t('epilogue.statHectaresBurnedBack'),
            value: String(s.blocksBurned),
            tone: 'good',
          },
          { label: t('epilogue.statForestPlanted'), value: ha(s.forestPlanted), tone: 'good' },
          {
            label: t('epilogue.statForestCover'),
            value: formatPercent(view.forestCover),
            tone: 'good',
          },
          { label: t('epilogue.statDisasters'), value: String(s.disasters) },
          profit(view.profitTotal),
        ];
      case 'reboisasi':
        return [
          { label: t('epilogue.statYears'), value: years },
          { label: t('epilogue.statForestPlanted'), value: ha(s.forestPlanted), tone: 'good' },
          {
            label: t('epilogue.statForestCover'),
            value: formatPercent(view.forestCover),
            tone: 'good',
          },
          { label: t('epilogue.statHectaresBearing'), value: String(view.matureHectares) },
          { label: t('epilogue.statDisasters'), value: String(s.disasters) },
          profit(view.profitTotal),
        ];
      case 'fade':
        return [
          { label: t('epilogue.statHectaresBearing'), value: String(view.matureHectares) },
          profit(view.profitTotal),
          { label: t('epilogue.statLastThree'), value: formatRp(lastThree) },
          { label: t('epilogue.statForestCover'), value: formatPercent(view.forestCover) },
          { label: t('epilogue.statDisasters'), value: String(s.disasters) },
          { label: t('epilogue.statPalmsLost'), value: count(s.palmsLost) },
        ];
      case 'bankrupt':
      case 'banned':
        return [
          { label: t('epilogue.statYears'), value: years },
          { label: t('epilogue.statDebt'), value: formatRp(Math.min(0, view.cash)), tone: 'bad' },
          {
            label: t('epilogue.statDaysBelowCredit'),
            value: String(view.insolventFor),
            tone: 'bad',
          },
          { label: t('epilogue.statHectaresBearing'), value: String(view.matureHectares) },
          { label: t('epilogue.statDisasters'), value: String(s.disasters) },
          { label: t('epilogue.statPalmsLost'), value: count(s.palmsLost) },
        ];
      case 'arrested':
        return [
          { label: t('epilogue.statNotices'), value: String(view.letters), tone: 'bad' },
          { label: t('epilogue.statBurnsLit'), value: String(s.burns), tone: 'bad' },
          burned,
          { label: t('epilogue.statNeighboursBurned'), value: ha(s.neighbourBlocksBurned) },
          { label: t('epilogue.statForestChopped'), value: ha(s.forestChopped) },
          settled(t('epilogue.statCoordinationFees')),
        ];
    }
  }

  const look = $derived(v ? LOOK[v.ending] : null);
  const certified = $derived(v ? v.ending === 'clean' || v.ending === 'dirty' : false);
  const win = $derived(certified || v?.ending === 'reboisasi' || v?.ending === 'redemption');
  // The scold is for a certificate won over burned ground. Redemption is the
  // one ending that already answers for its fires, so it is spared this.
  const arsonist = $derived(certified && (v?.stats.burns ?? 0) > 0);
  const forestWin = $derived(v?.ending === 'reboisasi' || v?.ending === 'redemption');
  const sandbox = $derived(win || v?.ending === 'fade');
  const rewind = $derived(v ? !win && v.rewindYears.length > 0 : false);
  const oldest = $derived(v ? Math.min(...v.rewindYears) : 0);
  const sponsor = REBOISASI.sponsor;
</script>

<!-- A note card: an icon tile and a line of text. -->
{#snippet note(iconName: IconName, body: Snippet, extra: string, testId?: string)}
  <div class="flex items-start gap-3 rounded-2xl border-2 px-4 py-3 {extra}" data-testid={testId}>
    <span
      class="flex h-9 w-9 flex-none items-center justify-center rounded-xl border-2 border-[var(--coral)] bg-[#fff1ec] shadow-[0_2px_0_var(--coral-edge)]"
    >
      <Icon name={iconName} />
    </span>
    <div class="min-w-0 text-sm leading-relaxed">{@render body()}</div>
  </div>
{/snippet}

{#if v && look}
  {@const years = yearsOf(v)}
  {#snippet headlineBody()}
    <b>“{v.headline?.title}”</b>; {v.headline?.body}
  {/snippet}
  {#snippet reboisasiBody()}
    <div class="text-base font-extrabold leading-snug text-[#2f7a2b]">
      “{t('epilogue.reboisasiQuote')}”
    </div>
    <div class="label mt-2 !text-[#2f7a2b] opacity-80" data-testid="epilogue-sponsor">
      {#if sponsor}
        {t('epilogue.presentedWith', { sponsor: `${sponsor.name}, ${sponsor.line}` })}
      {:else}
        {t('epilogue.presentedWith', { sponsor: '' })}
        <span class="italic">{t('epilogue.sponsorTba')}</span>
      {/if}
    </div>
  {/snippet}
  {#snippet redemptionBody()}
    <div class="text-base font-extrabold leading-snug text-[#2f7a2b]">
      “{t('epilogue.redemptionQuote')}”
    </div>
  {/snippet}
  {#snippet presidentBody()}
    <div class="label !text-[#9e2e20]">{t('epilogue.presidentLabel')}</div>
    <div class="mt-0.5 text-base font-extrabold text-[#9e2e20]">
      “{t('epilogue.presidentQuote')}”
    </div>
  {/snippet}
  {#snippet arsonistBody()}
    <div class="text-base font-extrabold leading-snug text-[#9e2e20]">
      {t('epilogue.arsonistTitle')}
    </div>
    <div class="mt-1 font-bold text-[#9e2e20] opacity-90">{t('epilogue.arsonistBody')}</div>
  {/snippet}

  <!-- Above the disclaimer band, and with nothing to click but its own two
       buttons: the run is over and the player says how it continues. -->
  <div class="absolute inset-0 z-[65] flex items-center justify-center bg-[rgba(30,20,12,0.6)] p-4">
    <div
      class="card flex max-h-full w-full max-w-2xl flex-col overflow-hidden {forestWin
        ? 'epilogue-glow'
        : ''}"
      data-testid="epilogue"
      data-ending={v.ending}
    >
      <div
        class="flex items-start gap-4 border-b-2 border-[var(--card-edge)] px-5 pb-4 pt-5"
        style="background: {look.band}"
      >
        <span
          class="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border-2 border-[var(--ink)]/70 shadow-[0_4px_0_rgba(74,51,32,0.45)]"
          style="background: {look.badge}"
        >
          <Icon name={look.icon} class="icon-lg !h-9 !w-9" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="label !text-[var(--ink)] opacity-70">{t(look.kicker)}</span>
            <span class="pill label !py-0.5 !text-[var(--ink)]">
              {t('epilogue.estateAt', { code: v.estateCode, date: formatDate(v.endedAt) })}
            </span>
          </div>
          <div
            class="mt-0.5 text-4xl font-extrabold leading-tight"
            style="color: {look.titleColor}"
            data-testid="epilogue-title"
          >
            {t(look.title)}
          </div>
          <p class="mt-1 text-sm font-bold opacity-80">
            {t(look.line)}
            {#if arsonist}
              {t('epilogue.arsonistLead')}
              <b class="text-[#9e2e20] opacity-100">{t('epilogue.arsonistShout')}</b>
            {/if}
          </p>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {#if v.headline}
          {@render note('news', headlineBody, 'bg-[var(--pill)] border-[var(--card-edge)]')}
        {/if}
        {#if v.ending === 'redemption'}
          {@render note(
            'shop-sapling',
            redemptionBody,
            'bg-[#eef7e4] border-[var(--green)]',
            'epilogue-redemption',
          )}
        {/if}
        {#if v.ending === 'reboisasi'}
          {@render note(
            'forest-cover',
            reboisasiBody,
            'bg-[#e4f6dc] border-[var(--green)]',
            'epilogue-reboisasi',
          )}
        {/if}
        {#if arsonist}
          {@render note(
            'fire',
            arsonistBody,
            'bg-[#ffdcd6] border-[var(--red)]',
            'epilogue-arsonist',
          )}
        {/if}
        {#if certified}
          {@render note(
            'certificate-palm',
            presidentBody,
            'bg-[#ffe6e0] border-[var(--coral)]',
            'epilogue-president',
          )}
        {/if}

        <div>
          <div class="label mb-2">{t(look.numbers)}</div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {#each stats(v) as stat (stat.label)}
              <div
                class="rounded-2xl border-2 px-4 py-3 {TONE_CLASS[stat.tone ?? 'plain']}"
                data-testid="epilogue-stat"
              >
                <div class="label !text-current opacity-70">{stat.label}</div>
                <div class="num mt-0.5 text-xl font-extrabold leading-tight">{stat.value}</div>
              </div>
            {/each}
          </div>
        </div>

        <div
          class="rounded-2xl border-2 border-[var(--card-edge)] bg-[var(--pill)] shadow-[0_3px_0_var(--card-shadow)]"
          data-testid="epilogue-timeline"
        >
          <button
            class="flex w-full items-center gap-2 px-4 py-2.5 text-left"
            data-testid="epilogue-timeline-toggle"
            aria-expanded={ui.timelineOpen}
            onclick={() => (ui.timelineOpen = !ui.timelineOpen)}
          >
            <span class="text-sm font-extrabold">{t('epilogue.howItWent')}</span>
            <span class="pill-muted label !py-0.5">
              {t('epilogue.eventsYears', {
                events: v.chronicle.length,
                years,
                yearWord: years === 1 ? t('epilogue.yearOne') : t('epilogue.yearMany'),
              })}
            </span>
            <span class="ml-auto flex items-center gap-1 text-sm font-extrabold opacity-70">
              {ui.timelineOpen ? t('epilogue.hide') : t('epilogue.show')}
              <Icon name={ui.timelineOpen ? 'chevron-up' : 'chevron-down'} class="!h-4 !w-4" />
            </span>
          </button>
          {#if ui.timelineOpen}
            <ol
              class="max-h-56 space-y-1 overflow-y-auto border-t-2 border-[var(--card-edge)] px-4 py-3 text-xs"
            >
              {#each v.chronicle as entry, i (i)}
                <li class="flex items-baseline gap-2">
                  <span class="inline-block h-2 w-2 shrink-0 rounded-full {LANE_DOT[entry.lane]}"
                  ></span>
                  <span class="w-28 shrink-0 tabular-nums opacity-60">{formatDate(entry.tick)}</span
                  >
                  <span
                    class={entry.severity === 'critical'
                      ? 'font-extrabold'
                      : 'font-bold opacity-85'}
                  >
                    {entry.title}
                  </span>
                </li>
              {/each}
            </ol>
          {/if}
        </div>

        {#if rewind}
          <div
            class="rounded-2xl border-2 border-[var(--blue)] bg-[#dbe7ff] px-4 py-3 text-[#2f56b8]"
          >
            <div class="flex items-center gap-2 text-base font-extrabold">
              <span aria-hidden="true">↺</span>
              {t('epilogue.tryAgain')}
            </div>
            <div class="text-xs font-bold opacity-80">{t('epilogue.sameSeed')}</div>
            <div class="mt-2 flex flex-wrap gap-2">
              {#each v.rewindYears.slice(0, 6) as year (year)}
                <button
                  class="btn btn-sm btn-blue"
                  data-testid={`epilogue-rewind-${year}`}
                  onclick={() => epilogue.handlers.rewind(year)}
                >
                  {year === oldest && year === 1
                    ? t('epilogue.yearStart', { year })
                    : t('epilogue.yearN', { year })}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="flex flex-wrap gap-2 border-t-2 border-[var(--card-edge)] px-5 py-4">
        {#if sandbox}
          <button
            class="btn btn-green btn-lg flex-1 flex-col !gap-0 !py-2 leading-tight"
            data-testid="epilogue-keep-playing"
            onclick={() => epilogue.handlers.keepPlaying()}
          >
            <span class="uppercase tracking-wide">{t('epilogue.keepPlaying')}</span>
            <span class="text-[0.68rem] font-bold opacity-85">{t('epilogue.sandbox')}</span>
          </button>
        {/if}
        <button
          class="btn btn-lg flex-1 uppercase tracking-wide {sandbox ? 'btn-ghost' : 'btn-coral'}"
          data-testid="epilogue-new-estate"
          onclick={() => epilogue.handlers.newEstate()}
        >
          {t('epilogue.newEstate')}
        </button>
      </div>
    </div>
  </div>
{/if}
