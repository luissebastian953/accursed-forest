<!-- The phone's header row: an icon tile, a title, optional extras, and the close button. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import { t } from '../../../i18n/index.ts';
  import type { IconName } from '../../icons.ts';

  import Icon from './Icon.svelte';

  interface Props {
    tile: IconName;
    title: string;
    closeTestId: string;
    onClose(): void;
    extra?: Snippet;
    subtitle?: Snippet;
  }

  const { tile, title, closeTestId, onClose, extra, subtitle }: Props = $props();
</script>

<div class="flex items-center gap-3 px-[6%] pb-2 pt-1">
  <span
    class="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border-2 border-[var(--coral-edge)] bg-[var(--coral)] shadow-[0_3px_0_var(--coral-edge)]"
  >
    <Icon name={tile} class="icon-lg" />
  </span>
  <div class="min-w-0">
    <div class="flex min-w-0 items-center gap-2">
      <span class="truncate text-2xl font-extrabold leading-none">{title}</span>
      {#if extra}{@render extra()}{/if}
    </div>
    {#if subtitle}{@render subtitle()}{/if}
  </div>
  <button
    class="btn btn-close ml-auto !h-11 !w-11 !rounded-2xl !text-lg"
    aria-label={t('phone.close')}
    data-testid={closeTestId}
    onclick={onClose}
  >
    ✕
  </button>
</div>
