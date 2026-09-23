<script lang="ts">
  import { HARVEST } from '@sim/balance/prices';

  import { t } from '../../../i18n/index.ts';
  import { formatRp } from '../../format.ts';
  import Icon from '../base/Icon.svelte';

  interface Props {
    on: boolean;
    toggle(): void;
    /** Beside Harvest it fills its column; on its own it spans the footer. */
    paired?: boolean;
  }

  const { on, toggle, paired = false }: Props = $props();
  const fee = formatRp(HARVEST.autoSurchargePerRound);
</script>

<!-- Running, the button is the way to stop it, so it wears the colour and the
     mark of the thing it would do rather than of the state it is in. -->
<button
  class="btn w-full flex-col !items-start justify-center gap-0.5 {paired ? 'h-full' : 'mt-2'} {on
    ? 'btn-red'
    : 'btn-ghost'}"
  title={on ? t('shop.autoTitleOn') : t('shop.autoTitleOff', { fee })}
  data-testid="toggle-auto-harvest"
  data-on={on}
  onclick={toggle}
>
  <span class="flex items-center gap-2 font-extrabold">
    {#if on}<Icon name="close-x" />{/if}
    {t('shop.autoHarvest')}
  </span>
  <span class="num text-xs font-bold opacity-85">
    {on ? t('shop.autoOn', { fee }) : t('shop.autoFee', { fee })}
  </span>
</button>
