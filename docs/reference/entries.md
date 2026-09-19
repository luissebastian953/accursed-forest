# Entry points

What each module is for, as it was written at the top of the file before the
headers moved here. A `§` number points into the [design document](../gdd/README.md).

## `src/main.ts`

The game's entry (`play.html`). The engine is a megabyte of three.js, so
it is loaded on demand behind the boot shell the page painted already;
the shell comes down once the app has mounted. `index.html` is the static
landing page and loads none of this.

## `src/workbench.ts`

The workbench's entry (`workbench.html`). A development page: it boots the
same renderer and materials the game does, with none of the simulation.
