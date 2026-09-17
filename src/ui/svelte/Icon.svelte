<!--
  One flat SVG from the design kit (`public/icons`), as an `<img>`: the same
  markup `icon()` in `../icons.ts` renders for the lit-html panels still
  waiting on their own Svelte port, so a page mixing both looks identical.
-->
<script lang="ts">
  import { iconUrl, type IconName } from '../icons.ts';

  interface Props {
    name: IconName;
    class?: string;
  }

  const { name, class: extraClass = '' }: Props = $props();
</script>

<img class="icon {extraClass}" src={iconUrl(name)} alt="" aria-hidden="true" />
