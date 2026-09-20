<!-- One flat SVG from the design kit (`public/icons`), as an `<img>`. -->
<script lang="ts">
  import { iconUrl, type IconName } from '../../icons.ts';

  interface Props {
    name: IconName;
    class?: string;
  }

  const { name, class: extraClass = '' }: Props = $props();
</script>

<img class="icon {extraClass}" src={iconUrl(name)} alt="" aria-hidden="true" />
