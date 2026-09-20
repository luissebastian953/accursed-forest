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

## `src/ui/styles.css`

Cartoon UI kit (design kit, Sep 2026): cream cards with a hard bottom edge,
inset pills, Baloo 2 throughout, and chunky buttons that press down.

Tokens first, then the handful of component classes every panel builds
from. The 3D palette lives in `render/materials/palette.ts`; the game
colours below mirror it so the HUD and the world stay in step (GDD 6.1).

## `src/ui/svelte/BlockPanel.svelte`

The block panel's markup (GDD 8 panel 9): the tiles, the pest section, the
burn options, and the open land and danger zone footers, drawn from
`blockPanelState.svelte.ts`'s `BlockView` snapshot.

### Notes

- `open land footer`: open land's two things to do with it (GDD 8 panel
  11a). The crew is the loud one; the saplings are the quiet one, and
  buying them is folded into the same press.
- `danger zone footer`: the danger zone (GDD 8 panel 13a) is folded shut by
  default so it never competes with Harvest or Fertilize. Unfolded, it
  shows the red button; that button only asks, and the card it opens names
  what goes.

## `src/ui/svelte/CertificatePanel.svelte`

The win condition, spelled out (design kit 7a). A gold band at the top, the
five conditions as rows with a bar each, and a footer that says what
meeting them is worth. Each row shows how far along it is, so a condition
that is nearly met does not look the same as one that has not started.

## `src/ui/svelte/Hud.svelte`

The top bar's markup: the cream card of tiles, the speed and ISPO buttons,
and the event chip strip below it, drawn from `hudState.svelte.ts`'s view.

### Notes

- `bar`/`card` measurement: the bar card grows with its own contents (the
  controls card, the ISPO checklist, the year-end card), so anything hung
  below it is told where its bottom edge is, rather than guessing a fixed
  offset.
- `$effect` bar measurement: it measures the bar card itself, not the
  column it sits in, because the column also holds the event chips, and a
  panel hung below those would open a hand's width from the bar on any day
  the weather is doing something.
- `ISPO button` states: three states, so progress reads without opening
  anything: nothing met is neutral, some met is gold, all met is green and
  waits on the Ministry's year-end check.

## `src/ui/svelte/HudMarker.svelte`

One pin over a hectare (design kit 6a): the Kopdes workshop, or a block the
pests have got into. The `kind` prop picks the pin and its colour; the
label pill sits above it and only appears on hover, so a field of sick
blocks does not bury the estate in text.

## `src/ui/svelte/KopdesShop.svelte`

The Kopdes shop's markup (GDD 8 panel 12): the buy and sell tabs, the
workers list, the picking toggle, the TBS price, recent sales and the
upgrade button, on the phone frame, drawn from `kopdesShopState.svelte.ts`'s
view.

### Notes

- `workers list` pill layout: one pill each, with the name on its own line,
  the job under it, and the button across the bottom. Side by side they
  wrapped three deep on the phone.

## `src/ui/svelte/Menu.svelte`

The menu (GDD 8 panel 16), in two steps. Its face carries the save, the
sound and the language; the new-estate form takes the whole card over when
it is asked for, because starting one replaces what is in play.

### Notes

- `new game button`: one button, and nothing else that can start a world by
  itself. With an estate in play it is a question in the quiet style; with
  nothing to lose, it is the coral call to action.

## `src/ui/svelte/Phone.svelte`

The cartoon smartphone (design kit, phone-frame asset) that the news feed
and the Kopdes shop both live on. The frame body sits under the screen, the
notch and home bar over it; the screen is the 400×840 safe zone of the
480×920 frame, with a status bar either side of the notch, a header, a
scrolling body (the children) and an optional footer above the home bar. It
stands between the HUD and the ticker, on the left.

### Notes

- `REFERENCE_WIDTH` scaling: the frame is sized by the viewport's height,
  so a zoomed-in browser or a short window shrinks it while rem-based type
  stays put and the screen turns dense. The screen content zooms with the
  frame's width instead: 1 at the 360px the layout was drawn for, never
  below 0.7 or above 1.1.

## `src/ui/svelte/Tooltip.svelte`

A hover bubble for anything the UI needs to explain in a few words: why a
button is locked, what a number means, what a pin is for.

It wraps its children rather than being placed by hand, so the bubble
follows whatever it labels. CSS does the showing, not state, which is the
one way it also works over a `disabled` button: a disabled control fires no
events, but the pointer still lands on it and `:hover` still reaches this
wrapper.

Usage:

```svelte
<Tooltip text={t('hud.speedLocked')}>
  <button disabled>50x</button>
</Tooltip>
```

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

### Notes

- `danger` (`BlockView`): the one thing on a planted block that cannot be
  taken back (GDD 8 panel 13a): felling the lot. Priced to hurt, and named
  for what it costs beyond the money, so the confirm step reads as a loss
  and not a form.
- `landView()`: open land's two futures (GDD 8 panel 11a), the crew with
  its timber or the saplings. Reforesting buys what the block is short of
  and plants it in one step, so the price shown is the whole price, and
  the note says why it cannot be paid when it cannot.
- `settleView()`: the coordination fee, as the Kopdes offers it (GDD 3.9).
  It appears only with something to settle, and says plainly when the
  district office is too honest to take it, rather than hiding the button.

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

### Notes

- `openedIntoForm`: whether the menu was opened straight into the form,
  from the title card's New estate. Cancel then means never mind, not back
  to the menu the player never asked for.
- `preview` getter: the estate the form describes, as its boxes stand. The
  name alone settles the code, so it moves as the player types; an empty
  pair means a world drawn at random, which has no code until it exists.
- `openNew(direct)`: step two, the boxes that describe a new estate. The
  `direct` parameter means it was opened from outside the menu, so Cancel
  closes it entirely rather than stepping back to the menu's face.
- `update()` name box refill: the name box starts on what this estate is
  called, so a player renaming one is editing rather than retyping. It is
  refilled only while the menu is shut, or when the estate itself changed,
  never over what is being typed.
- `create()` name requirement: the button is dead until the estate has a
  name, so there is always something to seed from, the seed box when it is
  filled, the name when it is not. A world drawn at random comes from the
  title card instead.

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

### Notes

- `preview` getter: the estate the card is offering, the one behind the
  title until the player types, then the one their boxes describe. The
  name alone settles the code, so it moves as they type.

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
