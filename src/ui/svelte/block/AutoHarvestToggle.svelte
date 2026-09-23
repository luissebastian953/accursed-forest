<!-- The Kopdes crew's picking rounds, on or off, with the surcharge spelled out. -->
<script lang="ts">
  import { HARVEST } from '@sim/balance/prices';

  import { t } from '../../../i18n/index.ts';
  import { formatRp } from '../../format.ts';
  import Icon from '../base/Icon.svelte';

  interface Props {
    on: boolean;
    toggle(): void;
  }

  const { on, toggle }: Props = $props();
  const fee = formatRp(HARVEST.autoSurchargePerRound);
</script>

<!-- Running, the button is the way to stop it, so it wears the colour and the
     mark of the thing it would do rather than of the state it is in. -->
<button
  class="btn mt-2 w-full justify-between {on ? 'btn-red' : 'btn-ghost'}"
  title={on ? t('shop.autoTitleOn') : t('shop.autoTitleOff', { fee })}
  data-testid="toggle-auto-harvest"
  data-on={on}
  onclick={toggle}
>
  <span class="flex items-center gap-2">
    {#if on}<Icon name="close-x" />{/if}
    {t('shop.autoHarvest')}
  </span>
  <span class="num rounded-lg px-1.5 py-0.5 text-xs {on ? 'bg-black/15' : 'bg-[#efe1bf]'}">
    {on ? t('shop.autoOn', { fee }) : t('shop.autoOff')}
  </span>
</button>
