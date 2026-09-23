# Interface

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

`src/ui/svelte/` is one folder per panel, and the entries below are in path
order, so a folder's files sit together. The `<name>State.svelte.ts` module is
the panel's public face: `App.ts` imports it and never a component.

| Folder       | The panel it is                                                    |
| ------------ | ------------------------------------------------------------------ |
| `base/`      | No game vocabulary: the icon, the tooltip, the phone frame         |
| `block/`     | The block panel, from the tiles to the danger zone                 |
| `hud/`       | The bar, its markers over the world, the work rings and the toasts |
| `news/`      | The ticker along the bar and the feed behind it                    |
| `authority/` | The letter, the investigation and the arrest cards                 |
| `shop/`      | The Kopdes shop: stock, prices, the payroll                        |
| `endings/`   | The year-end card, the certificate and the epilogue                |
| `start/`     | The title card, the menu and the controls help                     |

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

### Notes

- `--marquee-h`: the disclaimer band owns the top edge, so the top bar and
  the block panel's aside both start at this offset rather than at zero. It
  is a fixed height rather than a measured one, which keeps the band out of
  the layout path entirely: no observer, no JavaScript, and nothing to get
  out of step on a resize. `--panel-top`, which the controls-help popover
  hangs from, is measured off the bar's own rect and so follows for free.
- `.epilogue-glow`: the forest endings' gold halo (GDD 8 panel 15). It is CSS
  because `render/Glow.ts`'s bloom is a pass over the 3D scene and cannot
  reach a DOM panel. The keyframes restate the card's own `0 4px 0` lip in
  both stops, so the pressed edge every other card has is not dropped for the
  duration of the animation.
- `.marquee-track`: the loop is a single `translateX(-50%)` over two copies
  of the same sentence. Under `prefers-reduced-motion` the animation stops
  and the second copy is hidden, leaving one centred line, because scrolling
  words are unreadable to exactly the people that query is asking for.

## `src/ui/svelte/authority/AuthorityCards.svelte`

The paperwork itself (GDD 8 panel 17b): one card at a time, with the date the
notice runs to, or "until further notice" when it has no end. The settle
button appears on it only when `authorityCardsState.svelte.ts` says the
district office is taking calls.

## `src/ui/svelte/authority/authorityCardsState.svelte.ts`

The authorities' paperwork (GDD 8 panel 17b): the letter, the investigation
notice with its "settle the matter" option when integrity allows, and the
operating ban (GDD 3.8). The arrest is an ending; the epilogue tells it.
`AuthorityCards` keeps the pre-Svelte constructor and
`show`/`hide`/`showing`/`dispose` surface so `App.ts` is unchanged.

## `src/ui/svelte/base/Icon.svelte`

One flat SVG from the design kit (`public/icons`), rendered as an `<img>` and
hidden from assistive technology, since every icon in the interface sits
beside its own words.

## `src/ui/svelte/base/Phone.svelte`

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
- Anchored by its bottom, not its top. It used to hang from `--panel-top`
  with `bottom` set as well, which over-constrains an absolutely positioned
  box: once `min-height` beat the space available, `bottom` was the rule the
  browser dropped, and the handset grew off the foot of the screen. At 110%
  browser zoom that put 87px of it past the edge. It now takes its height
  from the space under the bar and stands on `bottom`, so a window too short
  for the minimum loses the top of the frame behind the HUD instead of losing
  the home bar off the bottom. `app.spec.ts` checks three window heights.

## `src/ui/svelte/base/PhoneHeader.svelte`

The phone frame's header row: an icon tile, a title, an optional subtitle and
extras, and the close button. The news feed and the Kopdes shop both sit on
`Phone.svelte`, so they share this header rather than each drawing one.

## `src/ui/svelte/base/Tooltip.svelte`

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

## `src/ui/svelte/block/AutoHarvestToggle.svelte`

The Kopdes crew's picking rounds, on or off, with the surcharge spelled out on
the button (`HARVEST.autoSurchargePerRound`). It appears on the Kopdes block
and on any planted block in range, because that is where the question comes up.

## `src/ui/svelte/block/BlockPanel.svelte`

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

## `src/ui/svelte/block/blockPanelState.svelte.ts`

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
- `fertilizerGain()`: the fertilizer tile said how long the window had left
  but never what it was worth, and what it is worth is not the flat fifth
  the shop implies: fertility is clamped to 1.4 (`GROWTH_FACTORS`), so a
  riverbank block keeps 17% of it and a block already under ash keeps
  almost none. The note runs `growthMultiplier` twice, once with the window
  and once without, and prints the real difference rather than the nominal
  one. Where the clamp has eaten all of it the note says so instead.
- `anyBearing()`: once anything on the block is carrying fruit, the fertilizer
  tile prints what the window is worth as fruit rather than as growth, because
  that is the number the player collects: a grown palm's height is not what
  the window is being spent on. The figure folds the fertility gain and
  `FERTILIZER_YIELD_BONUS` together, so it is the whole uplift and not just
  the new half of it.
- `burn.wonNote`: a won estate cannot light anything (GDD 3.8), and three
  identically greyed buttons with the same tooltip say that three times and
  badly. The note carries it once above the group, and the buttons keep the
  sim's own rejection underneath as every other action does.
- `coverCombo()`: an established cover crop under a reforesting block is
  the strongest thing a player can do to a slope (GDD 3.6.2), worth about
  six times bare planted ground before the growing forest starts pulling
  the cover term down as well. Nothing on screen said so, so the slope tile
  now either names the combination as the fix or confirms it is in place.

## `src/ui/svelte/disclaimer/DisclaimerModal.svelte`

The legal gate a first visit passes through (GDD 8 panel 0): a yellow warning
band with the `police-warning` icon, then the lead and three cards saying
that the estate and its officials are invented, that nothing here is advice,
and that chopping and burning are choices the game prices rather than things
it recommends. One button closes it, and it is the only way out: there is no
backdrop click and no Escape, because a gate that can be dismissed by
accident is not a gate.

It is raised by `play()` in `App.ts` when the player presses Play or Continue,
not at boot, so it reads as the last step of starting a run rather than as
something standing in front of the title screen.

## `src/ui/svelte/disclaimer/Marquee.svelte`

The reforestation band along the very top edge (GDD 8 panel 0), above the top
bar rather than over it. The copy is laid down twice inside the track so the
CSS loop can turn on a half translation with no seam, and the pair is marked
`aria-hidden` with the words carried once in an `sr-only` label beside it, so
a screen reader hears the sentence once rather than twice. The whole band is
a button: it reopens the disclaimer, which is how the gate stays reachable
after it has been accepted.

## `src/ui/svelte/disclaimer/disclaimerState.svelte.ts`

Mounts `DisclaimerModal.svelte` and owns whether it is up.

### Notes

- `sawit:disclaimer`: the acknowledgement is one `localStorage` key carrying
  a version, next to `sawit:locale`. Reading and writing it are both wrapped,
  and a browser with storage off falls through to showing the gate again,
  which errs on the side of it being read rather than skipped.
- `VERSION`: bumping it shows the gate again to everyone, which is what a
  change to the wording is for.

## `src/ui/svelte/disclaimer/marqueeState.svelte.ts`

Mounts `Marquee.svelte`. It holds no state: the band says the same thing all
run, so there is nothing for `App.ts` to update.

## `src/ui/svelte/endings/CertificatePanel.svelte`

The win condition, spelled out (design kit 7a). A gold band at the top, the
five conditions as rows with a bar each, and a footer that says what
meeting them is worth. Each row shows how far along it is, so a condition
that is nearly met does not look the same as one that has not started.

## `src/ui/svelte/endings/Epilogue.svelte`

The epilogue's markup (GDD 3.8, GDD 8 panel 15): the ending's own colours from
`LOOK`, the numbers that tell the truth about the run, and the chronicle as a
chain of headlines. The rewind buttons belong to a loss, sandbox to a
certificate or the fade.

### Notes

- `z-[65]`: above the disclaimer band (`z-[60]`), which is otherwise the top
  layer of the page. With no close button, no backdrop handler and `escape()`
  returning early while it is open, that leaves the two footer buttons as the
  only live controls on the screen, which is the intent: the run is over and
  the player chooses how it continues.
- `arsonist`: gates both the bold tail on the verdict line and the
  `epilogue-arsonist` card. It is `certified && stats.burns > 0`, so it reads
  the burns the player lit rather than `blocksBurned`, which a wildfire can
  raise without the player striking a match. `redemption` is excluded on
  purpose; see GDD 8 panel 15.
- `forestWin`: the only thing `.epilogue-glow` keys off. Kept separate from
  `win` because the certificate endings deliberately do not get it.

## `src/ui/svelte/endings/YearEndCard.svelte`

The year that just closed (GDD 8 panel 18), as a small card at the right: what
the estate earned, what it spent, and how the forest cover moved against last
year. It stops the clock until it is dismissed.

## `src/ui/svelte/endings/certificateState.svelte.ts`

certificate progress (GDD 8 panels 18–19): the year-end card each New Year, and the
five-condition checklist reachable from the top bar from Year 3, so the win
is legible before it happens. Both classes keep the pre-Svelte
constructor and `show`/`hide`/`isOpen`/`dispose` surface so `App.ts` is
unchanged.

## `src/ui/svelte/endings/epilogueState.svelte.ts`

The epilogue (GDD 3.8, GDD 8 panel 15): how the run ended, the numbers that tell
the truth about it, and the run replayed as a chain of headlines. Losses
offer the rewind; the certificate and the fade offer sandbox. `Epilogue`
keeps the pre-Svelte constructor and `show`/`hide`/`isOpen`/
`dispose` surface so `App.ts` is unchanged.

### Notes

- `FOREST_BAND`: `reboisasi` and `redemption` are the game's best endings and
  now say so in gold, where they used to wear a pale green and a green-orange
  that read as softer than the certificate's. Their badge tiles are
  deliberately left as they were.

## `src/ui/svelte/hud/Hud.svelte`

The top bar's markup: the cream card of tiles, the speed and certificate buttons,
and the event chip strip below it, drawn from `hudState.svelte.ts`'s view.

### Notes

- `bar`/`card` measurement: the bar card grows with its own contents (the
  controls card, the certificate checklist, the year-end card), so anything hung
  below it is told where its bottom edge is, rather than guessing a fixed
  offset.
- `$effect` bar measurement: it measures the bar card itself, not the
  column it sits in, because the column also holds the event chips, and a
  panel hung below those would open a hand's width from the bar on any day
  the weather is doing something.
- `certificate button` states: three states, so progress reads without opening
  anything: nothing met is neutral, some met is gold, all met is green and
  waits on the Ministry's year-end check.

## `src/ui/svelte/hud/HudMarker.svelte`

One pin over a hectare (design kit 6a): the Kopdes workshop, or a block the
pests have got into. The `kind` prop picks the pin and its colour; the
label pill sits above it and only appears on hover, so a field of sick
blocks does not bury the estate in text.

## `src/ui/svelte/hud/HudMarkers.svelte`

The pin layer over the world (GDD 8 panel 6). The layer lets clicks through and
each pin takes its own, so a marker can be clicked to select its block without
the layer swallowing a click meant for the terrain.

## `src/ui/svelte/hud/Toasts.svelte`

The toast stack at the bottom left: what just happened, in the estate's own
words, with a tone per kind (`TONE`). The dismiss control sits on the left,
where the icon used to be, so a stack of them can be cleared without the
pointer travelling.

## `src/ui/svelte/hud/WorkMarkers.svelte`

The crew's progress ring over a worked block (GDD 8 panel 6): a chop, a burn, a
dig or a felling, drawn as an SVG circle whose dash offset is the progress the
sim reports.

## `src/ui/svelte/hud/hudMarkersState.svelte.ts`

The pin layer (design kit 6a): a marker over the hectare a thing is
happening on. The Kopdes carries one so the workshop is findable from
anywhere; a block carries one when Ganoderma or the beetles have got into
it, so an infestation is visible without opening every block, or when a
slope has given way under it.

The App projects the world positions each frame and hands them over; the
markers themselves know nothing about the camera.

## `src/ui/svelte/hud/hudState.svelte.ts`

Top bar and time controls (GDD 8 panels 1–2, 5–8), in the cartoon kit: one
cream card of pills, icons from `icons.ts`, and chunky buttons. `Hud`
keeps the pre-Svelte constructor and `setHidden`/`update`/
`dispose` surface so `App.ts` is unchanged; the view it is given is held
raw and swapped whole on every update.

## `src/ui/svelte/hud/toastsState.svelte.ts`

Transient notices (GDD 8 panel 17): pop in, slide from the left, fade out
after a few seconds. The `Toasts` class keeps the exact constructor and
`push`/`dispose` surface it always had, so `App.ts` mounts and
drives it without knowing the rendering underneath changed.

## `src/ui/svelte/hud/workMarkersState.svelte.ts`

Progress rings over the blocks a crew is working (GDD 8 panel 22b): a circle
that fills as the chop, the burn or the dig advances, pinned above
the work site. The App projects each block's centre every frame and hands
the positions over; nothing here touches the camera.

## `src/ui/svelte/news/NewsPanel.svelte`

The news feed on the phone frame (GDD 8 panel 13): every headline the run has
seen, filtered by lane, each with its date and the line the player actually
reads. Lane colours come from `src/ui/newsLane.ts`, shared with the ticker.

## `src/ui/svelte/news/NewsTicker.svelte`

The headline strip along the bar (GDD 8 panel 3): the latest headline, in its
lane's colour, with the chip that opens the full feed behind it.

## `src/ui/svelte/news/newsPanelState.svelte.ts`

The news panel (GDD 8 panel 13): the full feed, newest first, with lane
filters and a "what this does to you" line per item, on the phone.
`NewsPanel` keeps the pre-Svelte constructor and
`show`/`hide`/`update`/`isOpen`/`dispose` surface so `App.ts` is
unchanged. The feed itself is held raw: it is the sim's own array, read,
never mutated here, and far too big to proxy.

## `src/ui/svelte/news/newsTickerState.svelte.ts`

The news ticker (GDD 8 panels 3 and 8): the latest three headlines along the
bottom, lane-coloured, with a badge for unread warnings. Click to open the
full feed. `NewsTicker` keeps the pre-Svelte constructor and
`update`/`setHidden`/`dispose` surface so `App.ts` is unchanged.

## `src/ui/svelte/shop/KopdesShop.svelte`

The Kopdes shop's markup (GDD 8 panel 12): the buy and sell tabs, the
workers list, the picking toggle, the TBS price, recent sales and the
upgrade button, on the phone frame, drawn from `kopdesShopState.svelte.ts`'s
view.

### Notes

- `workers list` pill layout: one pill each, with the name on its own line,
  the job under it, and the button across the bottom. Side by side they
  wrapped three deep on the phone.
- `item row` head: the name and the unit price shared a line, which left the
  name about sixty pixels. Names with a space wrapped three deep; a name with
  none, Metarhizium and Trichoderma, overflowed and painted over the price.
  The name now has the line, and the price sits with the stock under it. The
  worker pills read the same way, and the label rows in the sell tab carry a
  gap so a heading cannot touch its note.

## `src/ui/svelte/shop/kopdesShopState.svelte.ts`

The Kopdes shop (GDD 8 panel 12): a Buy tab for inputs at `base × index`, a
Sell tab showing today's TBS price, the intake and recent sales, and the
building's upgrade. The range ring is drawn on the map while it is open.

`KopdesShop` keeps the pre-Svelte constructor and
`open`/`close`/`toggle`/`refresh`/`isOpen`/`dispose` surface so `App.ts`
is unchanged. The sim is not reactive, so `refresh()` bumps a version the
view derives its snapshot (`shopView`) from.

## `src/ui/svelte/start/ControlsHelp.svelte`

The controls card (GDD 8): mouse, keyboard and what each does, in two columns.
It is reachable with H at any time, and from the menu, because a player who
needs it is usually already lost.

## `src/ui/svelte/start/Menu.svelte`

The menu (GDD 8 panel 16), in two steps. Its face carries the save, the
sound and the language; the new-estate form takes the whole card over when
it is asked for, because starting one replaces what is in play.

### Notes

- `new game button`: one button, and nothing else that can start a world by
  itself. With an estate in play it is a question in the quiet style; with
  nothing to lose, it is the coral call to action.

## `src/ui/svelte/start/StartScreen.svelte`

The title card (GDD 8 panel 1): the estate's name and seed, the language
switch, the summary of a save if there is one to continue, and the tiles that
say what the game is. The numbers on it come from the balance tables, so the
promise on the title card cannot drift from the game behind it.

## `src/ui/svelte/start/controlsHelpState.svelte.ts`

Controls (GDD 8 panel 4): which button does what, in a popover from the top
bar's "?" button or the H key. `ControlsHelp` keeps the pre-Svelte
constructor and `toggle`/`show`/`hide`/`isOpen`/`dispose` surface so
`App.ts` is unchanged.

## `src/ui/svelte/start/menuState.svelte.ts`

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

## `src/ui/svelte/start/startScreenState.svelte.ts`

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

## `src/ui/toastPolicy.ts`

What the estate is allowed to say, and how often (GDD 8). At 50x a day passes
every tenth of a second, so the notices arrive faster than anyone can read
them and the strip blinks rather than informs.

### Notes

- `offer()` answers `show`, `repeat` or `drop`. The same words already on
  screen are counted rather than said twice, which is what turns twenty
  identical sale notices into one with a number beside it.
- Nothing is dropped while the strip still has room: a drop only happens when
  a notice would push an unread one off a full strip, so a slow game loses
  nothing at all.
- A warning or an error is never dropped. A fire spreading is worth
  interrupting for even when the strip is full.
- Words are forgotten once they are older than the repeat window, so the same
  headline much later reads as news again rather than as a repeat.
