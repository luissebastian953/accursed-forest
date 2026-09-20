<!-- The Kopdes crew's picking rounds, on or off, with the surcharge spelled out. -->
<script lang="ts">
  import { HARVEST } from '@sim/balance/prices';

  import { t } from '../../../i18n/index.ts';
  import { formatRp } from '../../format.ts';

  interface Props {
    on: boolean;
    toggle(): void;
  }

  const { on, toggle }: Props = $props();
  const fee = formatRp(HARVEST.autoSurchargePerRound);
</script>

<button
  class="btn mt-2 w-full justify-between {on ? 'btn-green' : 'btn-ghost'}"
  title={on ? t('shop.autoTitleOn') : t('shop.autoTitleOff', { fee })}
  data-testid="toggle-auto-harvest"
  onclick={toggle}
>
  <span>{t('shop.autoHarvest')}</span>
  <span class="num rounded-lg px-1.5 py-0.5 text-xs {on ? 'bg-black/15' : 'bg-[#efe1bf]'}">
    {on ? t('shop.autoOn', { fee }) : t('shop.autoOff')}
  </span>
</button>
