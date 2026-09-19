# Documentation

Everything written down about Sawit Simulator, and where each kind of thing
belongs.

| Document                           | What it answers                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Game design (GDD)](gdd/README.md) | What the game is meant to be. The design's own numbering, `§3.6`, `§8`, is what the code cites. |
| [Architecture](architecture.md)    | How the code is arranged and which layer may talk to which.                                     |
| [The simulation](simulation.md)    | What happens on a tick, in what order, and why that order.                                      |
| [Decision records](adr/)           | Choices that were hard to make and would be expensive to reverse.                               |

## Where a new piece of writing goes

- **A rule of the game**, what a thing costs or how a system behaves: the GDD.
  The code cites it by section, so the design stays the source of truth.
- **A decision with a cost**, where the obvious approach was rejected for a
  reason: a new ADR in [`adr/`](adr/). Numbered, dated, and never edited once
  merged; a later record supersedes an earlier one.
- **How the code is shaped**, layers, data flow, the tick: this directory.
- **Why one function does something surprising**: a comment, next to the code.
  A comment that explains a decision belongs in an ADR as well, with the
  comment pointing at it.

## The section numbers in the code

378 comments across `src/` cite the design document by section, from `§2` to
`§10.3`. They are not decoration: they are how a reader gets from a constant
back to the rule it serves. [The GDD's index](gdd/README.md) lists every
section the code refers to and where its text lives.
