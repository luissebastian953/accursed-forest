import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** Plain Svelte (no SvelteKit): used by `svelte-check` and the editor. */
export default {
  preprocess: vitePreprocess(),
};
