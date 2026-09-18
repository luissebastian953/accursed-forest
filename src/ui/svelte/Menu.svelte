<script lang="ts">
  import { locale, LOCALES, localeTag, setLocale, t, type Locale } from '../../i18n/index.ts';

  import type { Menu } from './menuState.svelte.ts';

  interface Props {
    menu: Menu;
  }

  const { menu }: Props = $props();
  const state = $derived(menu.state);

  const LANGUAGE: Record<Locale, string> = { en: 'English', id: 'Bahasa Indonesia' };

  const savedLine = $derived(
    state.view.lastSavedAt
      ? t('menu.lastSaved', { when: new Date(state.view.lastSavedAt).toLocaleString(localeTag()) })
      : t('menu.notSaved'),
  );
</script>

{#if state.open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(74,51,32,0.45)] p-4"
    onclick={(e) => e.target === e.currentTarget && menu.hide()}
  >
    <div class="card w-full max-w-md p-6" data-testid="menu">
      <div class="mb-4 flex items-start justify-between">
        <div>
          <div class="text-2xl font-extrabold text-[#3faa4c]">Sawit Simulator</div>
          <div class="label mt-1">
            {t('menu.estateCode')}
            <span class="pill-muted px-1.5 py-0.5">{state.view.estateCode}</span>
          </div>
        </div>
        <button class="btn btn-close" aria-label={t('menu.close')} onclick={() => menu.hide()}>
          ✕
        </button>
      </div>

      <div class="mb-5 grid grid-cols-2 gap-2">
        <button
          class="btn btn-green btn-lg"
          data-testid="menu-save"
          onclick={() => menu.handlers.save()}
        >
          {t('menu.save')}
        </button>
        <button
          class="btn btn-ghost btn-lg"
          disabled={!state.view.hasSave}
          data-testid="menu-load"
          onclick={() => menu.handlers.load()}
        >
          {t('menu.load')}
        </button>
      </div>
      <div class="muted mb-5 text-xs">
        {#if state.view.saveError}
          <span class="text-[#9e2e20]">{state.view.saveError}</span>
        {:else}
          {savedLine}
        {/if}
      </div>

      <div class="mb-3 flex items-center justify-between gap-3">
        <div class="text-sm font-extrabold">{t('menu.sound')}</div>
        <button
          class={`btn ${state.view.sound ? 'btn-green' : 'btn-ghost'} !px-3 !py-1.5 text-xs`}
          aria-pressed={state.view.sound}
          data-testid="menu-sound"
          onclick={() => menu.handlers.setSound(!state.view.sound)}
        >
          {state.view.sound ? t('menu.soundOn') : t('menu.soundOff')}
        </button>
      </div>

      <div class="mb-5 flex items-center justify-between gap-3">
        <div class="text-sm font-extrabold">{t('menu.language')}</div>
        <div class="flex gap-1.5" role="group" aria-label={t('menu.language')}>
          {#each LOCALES as code (code)}
            <button
              class={`btn ${locale() === code ? 'btn-green' : 'btn-ghost'} !px-3 !py-1.5 text-xs`}
              aria-pressed={locale() === code}
              data-testid={`menu-lang-${code}`}
              onclick={() => setLocale(code)}
            >
              {LANGUAGE[code]}
            </button>
          {/each}
        </div>
      </div>

      <div class="border-t-2 border-dashed border-[#f2e0b0] pt-4">
        <div class="mb-2 text-sm font-extrabold">{t('menu.newEstate')}</div>
        <div class="flex flex-col gap-2">
          <input
            class="min-w-0 flex-1 rounded-xl border-2 border-[#f2e0b0] bg-white px-3 py-2 text-sm font-bold text-[#4a3320] outline-none placeholder:text-[#c4b083] focus:border-[#5fd06a]"
            placeholder={t('menu.codePlaceholder')}
            bind:value={state.code}
            oninput={() => (state.codeError = false)}
          />
          <button
            class="btn btn-coral btn-lg w-full uppercase tracking-wide"
            data-testid="menu-new"
            onclick={() => menu.startNew()}
          >
            {t('menu.startGame')}
          </button>
        </div>
        {#if state.codeError}
          <div class="mt-1 text-xs font-bold text-[#b85e12]">{t('menu.codeError')}</div>
        {/if}
        <div class="muted mt-2 text-xs">{t('menu.codeHint')}</div>
      </div>
    </div>
  </div>
{/if}
