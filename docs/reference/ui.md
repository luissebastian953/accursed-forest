# Interface

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/ui/format.ts`

Formatting helpers shared by the panels. Sim time is an integer tick (GDD 10.2).

## `src/ui/icons.ts`

The cartoon icon set (design kit): flat SVGs served from `public/icons`.
`Icon.svelte` renders one; `iconUrl` is for CSS backgrounds.

## `src/ui/newsLane.ts`

The news feed's three lanes (GDD 8 panels 3, 8, 13): a colour and a message
key, shared by the ticker and the full feed panel.

## `src/ui/svelte/authorityCardsState.svelte.ts`

The authorities' paperwork (GDD 8 panel 17b): the letter, the investigation
notice with its "settle the matter" option when integrity allows, and the
operating ban (GDD 3.8). The arrest is an ending; the epilogue tells it.
`AuthorityCards` keeps the pre-Svelte constructor and
`show`/`hide`/`showing`/`dispose` surface so `App.ts` is unchanged.

## `src/ui/svelte/blockPanelState.svelte.ts`

The block panel (GDD 8 panel 9): what the selected block is, and what you can
do with it. Invalid actions stay visible with the sim's own rejection
reason, so the player learns the rules by reading, not by guessing.

Planted blocks get a pest section with a clickable 12×12 slot grid; the
per-palm panel of GDD 8 #10 without needing per-palm 3D picking.

`BlockPanel` keeps the pre-Svelte constructor and
`show`/`refresh`/`selected`/`dispose` surface so `App.ts` is unchanged.
The sim is not reactive, so `refresh()` bumps a version and the view
derives a plain snapshot (`blockView`) from it; the snapshot carries its
text already localized, so a language switch re-derives it too.

## `src/ui/svelte/certificateState.svelte.ts`

ISPO progress (GDD 8 panels 18–19): the year-end card each New Year, and the
five-condition checklist reachable from the top bar from Year 3, so the win
is legible before it happens. Both classes keep the pre-Svelte
constructor and `show`/`hide`/`isOpen`/`dispose` surface so `App.ts` is
unchanged.

## `src/ui/svelte/controlsHelpState.svelte.ts`

Controls (GDD 8 panel 4): which button does what, in a popover from the top
bar's "?" button or the H key. `ControlsHelp` keeps the pre-Svelte
constructor and `toggle`/`show`/`hide`/`isOpen`/`dispose` surface so
`App.ts` is unchanged.

## `src/ui/svelte/epilogueState.svelte.ts`

The epilogue (GDD 3.8, GDD 8 panel 15): how the run ended, the numbers that tell
the truth about it, and the run replayed as a chain of headlines. Losses
offer the rewind; the certificate and the fade offer sandbox. `Epilogue`
keeps the pre-Svelte constructor and `show`/`hide`/`isOpen`/
`dispose` surface so `App.ts` is unchanged.

## `src/ui/svelte/hudMarkersState.svelte.ts`

The pin layer (design kit 6a): a marker over the hectare a thing is
happening on. The Kopdes carries one so the workshop is findable from
anywhere; a block carries one when Ganoderma or the beetles have got into
it, so an infestation is visible without opening every block, or when a
slope has given way under it.

The App projects the world positions each frame and hands them over; the
markers themselves know nothing about the camera.

## `src/ui/svelte/hudState.svelte.ts`

Top bar and time controls (GDD 8 panels 1–2, 5–8), in the cartoon kit: one
cream card of pills, icons from `icons.ts`, and chunky buttons. `Hud`
keeps the pre-Svelte constructor and `setHidden`/`update`/
`dispose` surface so `App.ts` is unchanged; the view it is given is held
raw and swapped whole on every update.

## `src/ui/svelte/kopdesShopState.svelte.ts`

The Kopdes shop (GDD 8 panel 12): a Buy tab for inputs at `base × index`, a
Sell tab showing today's TBS price, the intake and recent sales, and the
building's upgrade. The range ring is drawn on the map while it is open.

`KopdesShop` keeps the pre-Svelte constructor and
`open`/`close`/`toggle`/`refresh`/`isOpen`/`dispose` surface so `App.ts`
is unchanged. The sim is not reactive, so `refresh()` bumps a version the
view derives its snapshot (`shopView`) from.

## `src/ui/svelte/menuState.svelte.ts`

The menu (GDD 8 panel 16): save, load, a new estate, and the language.
`Menu` keeps the pre-Svelte constructor and
`toggle`/`show`/`hide`/`update`/`isOpen`/`dispose` surface so `App.ts` is
unchanged; the view reads `state` and calls back into the class.

Starting a new estate takes two steps (GDD 8 panel 16a). A save is replaced
the moment a new world begins, so the boxes that describe one are kept off
the menu's face: the first step is a single button, the second is the form.
Anything that dismisses the menu puts it back on the first step, so nobody
reopens it to find a half-filled form pointed at their estate.

## `src/ui/svelte/newsPanelState.svelte.ts`

The news panel (GDD 8 panel 13): the full feed, newest first, with lane
filters and a "what this does to you" line per item, on the phone.
`NewsPanel` keeps the pre-Svelte constructor and
`show`/`hide`/`update`/`isOpen`/`dispose` surface so `App.ts` is
unchanged. The feed itself is held raw: it is the sim's own array, read,
never mutated here, and far too big to proxy.

## `src/ui/svelte/newsTickerState.svelte.ts`

The news ticker (GDD 8 panels 3 and 8): the latest three headlines along the
bottom, lane-coloured, with a badge for unread warnings. Click to open the
full feed. `NewsTicker` keeps the pre-Svelte constructor and
`update`/`setHidden`/`dispose` surface so `App.ts` is unchanged.

## `src/ui/svelte/startScreenState.svelte.ts`

The title screen (GDD 8 panel 1, design kit 5a): a modal over the live estate,
pulled back so the terrain reads as a dimmed backdrop. Two states:

- first launch, or nothing saved in this browser: the large start card;
  Start a game, an estate code to share a world, How to play, Settings,
  and three facts drawn from the balance tables;
- a save in this browser: the medium "welcome back" card; the estate,
  when it was saved, where it stands, what is going on there, Continue,
  and the ways out (the menu's saves and codes, or a new estate).

On start or continue the card fades and the camera pulls in; the App owns
that camera move. `StartScreen` keeps the pre-Svelte constructor
and `show`/`dismiss`/`isOpen`/`dispose` surface so `App.ts` is unchanged.

## `src/ui/svelte/toastsState.svelte.ts`

Transient notices (GDD 8 panel 17): pop in, slide from the left, fade out
after a few seconds. The `Toasts` class keeps the exact constructor and
`push`/`dispose` surface it always had, so `App.ts` mounts and
drives it without knowing the rendering underneath changed.

## `src/ui/svelte/workMarkersState.svelte.ts`

Progress rings over the blocks a crew is working (GDD 8 panel 22b): a circle
that fills as the chop, the burn or the dig advances, pinned above
the work site. The App projects each block's centre every frame and hands
the positions over; nothing here touches the camera.
