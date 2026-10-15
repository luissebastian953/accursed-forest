# Entry points

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/main.ts`

The game's entry (`play.html`). The app is a static import, so Vite writes
`modulepreload` links for it and for three.js into the page and the engine
downloads in parallel with the first script; the dev pages (`?spike`,
`?models`, `?mobs`) stay behind dynamic imports. The boot shell the page
painted comes down once the app has mounted. `index.html` is the static
landing page and loads none of this.

## `src/workbench.ts`

The workbench's entry (`workbench.html`). A development page: it boots the
same renderer and materials the game does, with none of the simulation.

## `src/vite-env.d.ts`

The Vite client types, so `import.meta.env` and the asset imports are typed. No
code, and nothing to configure.
