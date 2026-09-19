<script lang="ts">
  import { GROWTH } from '@sim/balance/growth';
  import { ECONOMY } from '@sim/balance/prices';

  import { locale, LOCALES, localeTag, setLocale, t } from '../../i18n/index.ts';
  import { formatRp } from '../format.ts';
  import type { IconName } from '../icons.ts';

  import { ENDING_COUNT } from './epilogueState.svelte.ts';
  import Icon from './Icon.svelte';
  import type { SaveSummary, StartScreen } from './startScreenState.svelte.ts';

  interface Props {
    screen: StartScreen;
  }

  const { screen }: Props = $props();
  const ui = $derived(screen.ui);
  /** The estate the card is offering: it moves as the boxes are typed into. */
  const preview = $derived(screen.preview);
  const v = $derived(screen.view);

  const CHIP_TONE: Record<SaveSummary['chips'][number]['tone'], string> = {
    fire: 'chip-fire',
    smoke: 'chip-smoke',
    ash: 'chip-ash',
    water: 'chip-water',
    dry: 'chip-dry',
    pest: 'chip-pest',
    econ: 'chip-econ',
    plain: 'chip-cream',
  };

  /** "Saved today 15:28", or the date for older saves. */
  function savedLabel(iso: string | null): string {
    if (!iso) return t('start.saved');
    const when = new Date(iso);
    if (Number.isNaN(when.getTime())) return t('start.saved');
    const now = new Date();
    const time = when.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' });
    if (when.toDateString() === now.toDateString()) return t('start.savedToday', { time });
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain arithmetic, not state
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (when.toDateString() === yesterday.toDateString()) {
      return t('start.savedYesterday', { time });
    }
    const date = when.toLocaleDateString(localeTag(), { day: 'numeric', month: 'short' });
    return t('start.savedOn', { date, time });
  }

  const bearYear = Math.ceil(GROWTH.immatureDays / GROWTH.daysPerYear);
  const facts = $derived.by((): [IconName, string][] => {
    const words = t('start.words').split(',');
    return [
      ['coin', t('start.factCash', { cash: formatRp(ECONOMY.startingCash) })],
      ['shop-sapling', t('start.factBear', { year: bearYear })],
      ['news', t('start.factEndings', { n: words[ENDING_COUNT - 1] ?? ENDING_COUNT })],
    ];
  });
</script>

{#if ui.open}
  <div
    class="start-screen absolute inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 {ui.leaving
      ? 'start-out'
      : ''}"
    data-testid="start-screen"
    data-mode={v.save ? 'continue' : 'start'}
  >
    <div class="absolute right-4 top-3 flex gap-1.5" role="group" aria-label={t('start.language')}>
      {#each LOCALES as code (code)}
        <button
          class="btn {locale() === code
            ? 'btn-green'
            : 'btn-ghost'} !px-3 !py-1.5 text-xs uppercase"
          aria-pressed={locale() === code}
          data-testid={`start-lang-${code}`}
          onclick={() => setLocale(code)}
        >
          {code}
        </button>
      {/each}
    </div>

    <div class="flex w-full max-w-xl flex-col items-center gap-3 text-center">
      {#if v.save === null}
        <img
          class="h-20 w-20 drop-shadow-[0_6px_0_rgba(47,122,43,0.55)]"
          src={`${import.meta.env.BASE_URL}brand/sawit-mark-transparent.svg`}
          width="80"
          height="80"
          alt=""
        />
        <span class="pill label !text-[var(--ink)] shadow-[0_3px_0_var(--card-shadow)]">
          {t('start.tagline')}
        </span>
        <h1 class="title-extrude m-0 text-[clamp(3rem,9vw,5.5rem)] font-extrabold leading-[0.95]">
          Sawit<br />Simulator
        </h1>
        <p class="card m-0 px-5 py-2 text-base font-extrabold">{t('start.lede')}</p>

        <div class="card mt-2 flex w-full flex-col gap-3 p-5 text-left">
          <form
            class="flex flex-col gap-3"
            onsubmit={(e) => {
              e.preventDefault();
              screen.submitCode();
            }}
          >
            <button
              class="btn btn-coral btn-lg w-full !py-3 !text-xl uppercase tracking-wider"
              type="submit"
              data-testid="start-game"
            >
              {t('start.startGame')}
            </button>
            <label class="pill flex min-w-0 items-center gap-2 !py-2">
              <span aria-hidden="true">🌱</span>
              <input
                class="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--ink-3)]"
                placeholder={t('start.namePlaceholder')}
                data-testid="start-name"
                maxlength="40"
                bind:value={ui.name}
              />
            </label>
            <label class="pill flex min-w-0 items-center gap-2 !py-2">
              <span aria-hidden="true">🔒</span>
              <input
                class="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--ink-3)]"
                placeholder={t('start.codePlaceholder')}
                data-testid="start-code"
                bind:value={ui.code}
              />
            </label>
          </form>
          <p class="muted m-0 text-center text-xs font-bold">
            {#if ui.error}
              <span class="text-[#9e2e20]">{ui.error}</span>
            {:else}
              {preview.isNew ? t('start.newCodeHint') : t('start.codeHint')}
              <b class="num" data-testid="start-code-preview">
                {preview.code || t('start.randomCode')}
              </b>.
            {/if}
          </p>
          <div class="border-t-2 border-dashed border-[var(--card-edge)]"></div>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="btn btn-ghost"
              data-testid="start-help"
              onclick={() => screen.handlers.howToPlay()}
            >
              {t('start.howToPlay')}
            </button>
            <button
              class="btn btn-ghost"
              data-testid="start-settings"
              onclick={() => screen.handlers.settings()}
            >
              {t('start.settings')}
            </button>
          </div>
        </div>

        <div class="mt-1 flex flex-wrap justify-center gap-2 text-xs font-extrabold">
          {#each facts as [name, text] (name)}
            <span class="card flex items-center gap-1.5 !rounded-xl px-3 py-1.5">
              <Icon {name} />
              {text}
            </span>
          {/each}
        </div>
      {:else}
        {@const save = v.save}
        <h1 class="title-extrude m-0 text-[clamp(2rem,5vw,3rem)] font-extrabold">
          Sawit Simulator
        </h1>

        <div
          class="card mt-4 flex w-full max-w-lg flex-col gap-3 p-5 text-left"
          data-testid="start-welcome"
        >
          <div class="label">{t('start.welcomeBack')}</div>
          <div
            class="flex flex-col gap-3 rounded-2xl border-2 border-[var(--green)] bg-[#e9f7e2] p-4"
          >
            <div class="flex items-center gap-3">
              <span
                class="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border-2 border-[var(--green-edge)] bg-white"
              >
                <Icon name="shop-sapling" class="icon-lg !h-9 !w-9" />
              </span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="text-xl font-extrabold text-[var(--green-edge)]"
                    data-testid="start-estate"
                  >
                    {t('start.estate')} <span class="num">{save.code}</span>
                  </span>
                  <span class="pill label !py-0.5 !text-[var(--green-edge)]"
                    >{savedLabel(save.savedAt)}</span
                  >
                </div>
                <div class="num text-sm font-extrabold">
                  {t('start.summary', {
                    year: save.year,
                    day: save.day,
                    ha: save.plantedHectares,
                    cash: formatRp(save.cash),
                  })}
                </div>
              </div>
            </div>
            {#if save.chips.length > 0}
              <div class="flex flex-wrap gap-1.5 text-xs">
                {#each save.chips as chip, i (i)}
                  <span class="chip {CHIP_TONE[chip.tone]}">
                    <Icon name={chip.icon} />
                    {chip.label}
                  </span>
                {/each}
              </div>
            {/if}
            <button
              class="btn btn-green btn-lg w-full !py-3 !text-xl uppercase tracking-wider"
              data-testid="start-continue"
              onclick={() => screen.handlers.resume()}
            >
              {t('start.continue')}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              class="btn btn-ghost"
              data-testid="start-load-other"
              onclick={() => screen.handlers.loadOther()}
            >
              {t('start.savesCodes')}
            </button>
            <button
              class="btn btn-coral"
              data-testid="start-new"
              onclick={() => screen.handlers.newEstate()}
            >
              {t('start.newEstate')}
            </button>
          </div>
          <p class="muted m-0 text-center text-xs font-bold">{t('start.oneSlot')}</p>
        </div>
      {/if}
    </div>
    <div class="label absolute bottom-3 left-4 !text-[#fff6e0] opacity-80">{v.build}</div>
  </div>
{/if}
