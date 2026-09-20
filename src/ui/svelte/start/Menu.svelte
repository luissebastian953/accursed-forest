<script lang="ts">
  import { locale, LOCALES, localeTag, setLocale, t, type Locale } from '../../../i18n/index.ts';
  import Icon from '../base/Icon.svelte';

  import type { Menu } from './menuState.svelte.ts';

  interface Props {
    menu: Menu;
  }

  const { menu }: Props = $props();
  const state = $derived(menu.state);
  /** The estate the form's boxes describe, as they stand. */
  const preview = $derived(menu.preview);
  /** An estate with no name has nothing to be called, so it cannot be made. */
  const nameable = $derived(state.name.trim() !== '');
  /** What a new estate would replace: the name if it has one, else the code. */
  const replacing = $derived(state.view.estateName || state.view.estateCode);

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
    class="absolute inset-0 z-[60] flex items-center justify-center bg-[rgba(74,51,32,0.45)] p-4"
    onclick={(e) => e.target === e.currentTarget && menu.hide()}
  >
    <div class="card w-full max-w-md p-6" data-testid="menu" data-step={state.step}>
      {#if state.step === 'new'}
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-[#bfe3b4] bg-[#eef8e9]"
            >
              <Icon name="shop-sapling" class="!h-7 !w-7" />
            </span>
            <div>
              <div class="label">{t('menu.brand')}</div>
              <div class="text-2xl font-extrabold text-[#3faa4c]">{t('menu.newEstate')}</div>
            </div>
          </div>
          <button class="btn btn-close" aria-label={t('menu.close')} onclick={() => menu.hide()}>
            ✕
          </button>
        </div>

        <!--
          Shown whenever there is something to lose: an estate in play, or a
          save sitting in this browser that the new one would overwrite.
        -->
        {#if state.view.inPlay || state.view.hasSave}
          <div
            class="mb-4 flex items-start gap-2.5 rounded-2xl border-2 border-[#f3c9bf] bg-[#fdeae6] p-3"
            data-testid="menu-replace-warning"
          >
            <span class="text-base leading-none" aria-hidden="true">⚠</span>
            <p class="m-0 text-sm font-bold leading-snug text-[#8a3a26]">
              {t('menu.replaceWarning', { estate: replacing })}
            </p>
          </div>
        {/if}

        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="label">{t('menu.namePlaceholder')}</span>
            <input
              class="min-w-0 flex-1 rounded-xl border-2 border-[#f2e0b0] bg-white px-3 py-2.5 text-sm font-bold text-[#4a3320] outline-none placeholder:text-[#c4b083] focus:border-[#5fd06a]"
              placeholder={t('menu.namePlaceholderHint')}
              data-testid="menu-name"
              maxlength="40"
              bind:value={state.name}
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="label">{t('menu.seedLabel')}</span>
            <input
              class="min-w-0 flex-1 rounded-xl border-2 border-[#f2e0b0] bg-white px-3 py-2.5 text-sm font-bold text-[#4a3320] outline-none placeholder:text-[#c4b083] focus:border-[#5fd06a]"
              placeholder={t('menu.codePlaceholder')}
              data-testid="menu-seed"
              bind:value={state.code}
            />
          </label>
        </div>

        <p class="muted m-0 mt-3 text-center text-xs font-bold">
          {t('menu.seedHint')}
          <b class="num" data-testid="menu-code-preview">
            {preview.random ? t('menu.randomCode') : preview.code}
          </b>.
        </p>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            class="btn btn-ghost btn-lg"
            data-testid="menu-new-cancel"
            onclick={() => menu.cancelNew()}
          >
            ✕ {t('menu.cancel')}
          </button>
          <button
            class="btn btn-green btn-lg"
            disabled={!nameable}
            title={nameable ? null : t('menu.nameNeeded')}
            data-testid="menu-new-create"
            onclick={() => menu.create()}
          >
            ✓ {t('menu.create')}
          </button>
        </div>
      {:else}
        <div class="mb-4 flex items-start justify-between">
          <div>
            <div class="text-2xl font-extrabold text-[#3faa4c]">{t('menu.brand')}</div>
            {#if state.view.inPlay}
              {#if state.view.estateName}
                <div class="mt-1 text-sm font-extrabold" data-testid="menu-estate-name">
                  {state.view.estateName}
                </div>
              {/if}
              <div class="label mt-1">
                {t('menu.estateCode')}
                <span class="pill-muted px-1.5 py-0.5" data-testid="menu-estate-code">
                  {state.view.estateCode}
                </span>
              </div>
            {:else}
              <div class="muted mt-1 text-sm font-extrabold" data-testid="menu-no-estate">
                {t('menu.noEstate')}
              </div>
            {/if}
          </div>
          <button class="btn btn-close" aria-label={t('menu.close')} onclick={() => menu.hide()}>
            ✕
          </button>
        </div>

        <div class="mb-5 grid grid-cols-2 gap-2">
          <button
            class="btn btn-green btn-lg"
            disabled={!state.view.inPlay}
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
        {#if state.view.inPlay}
          <div class="muted mb-5 text-xs">
            {#if state.view.saveError}
              <span class="text-[#9e2e20]">{state.view.saveError}</span>
            {:else}
              {savedLine}
            {/if}
          </div>
        {/if}

        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="text-sm font-extrabold">{t('menu.sound')}</div>
          <div class="flex items-center gap-2">
            <button
              class={`btn ${state.view.sound ? 'btn-green' : 'btn-red'} !px-3 !py-1.5`}
              aria-pressed={state.view.sound}
              aria-label={t('menu.sound')}
              data-testid="menu-sound"
              onclick={() => menu.handlers.setSound(!state.view.sound)}
            >
              <Icon name={state.view.sound ? 'speaker-on' : 'speaker-off'} />
            </button>
            <span class="text-sm font-extrabold" data-testid="menu-sound-label">
              {state.view.sound ? t('menu.soundOn') : t('menu.soundOff')}
            </span>
          </div>
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

        <!-- One button: a quiet question with an estate in play, the coral call with nothing to lose. -->
        <div class="border-t-2 border-dashed border-[#f2e0b0] pt-4">
          <button
            class={`btn ${state.view.inPlay ? 'btn-ghost' : 'btn-coral uppercase tracking-wide'} btn-lg w-full`}
            data-testid="menu-new"
            onclick={() => menu.openNew()}
          >
            {#if state.view.inPlay}
              <Icon name="shop-sapling" />
              {t('menu.newGamePrompt')}
            {:else}
              {t('menu.newGameFresh')}
            {/if}
          </button>
          <div class="muted mt-2 text-center text-xs">
            {state.view.inPlay ? t('menu.newGameNoteSave') : t('menu.newGameNoteFresh')}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
