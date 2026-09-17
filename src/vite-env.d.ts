/// <reference types="vite/client" />

/** package.json version, stamped by Vite at build time (see vite.config.ts). */
declare const __APP_VERSION__: string;

/**
 * `tsc --noEmit` does not parse `.svelte` files itself; `svelte-check` does
 * that, with real prop types. This just satisfies a `.ts` file's `import`.
 */
declare module '*.svelte' {
  import type { Component } from 'svelte';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches svelte's own Component<Props extends Record<string, any>>
  const component: Component<Record<string, any>>;
  export default component;
}
