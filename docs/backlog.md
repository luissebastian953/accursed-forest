# Backlog

Work that is understood but not done, so it is not carried in someone's head.
An item earns a place here by being specific enough to start: what, where, and
why it matters. Anything already decided against belongs in an
[ADR](adr/) instead.

## Dead rules the code still carries

Found while writing the design document, recorded there and unfixed:

- `Block.bannedUntil` is read by `ChopBlock`, `BurnBlock` and `PlantBlock`, is
  initialised to -1, and is never set anywhere. Only the estate-wide
  `operatingBanUntil` bans anything today. Either wire it to something (a
  per-block sanction) or take it out, including from the save schema.
- The `plague.start` headline says Ganoderma spread "doubles" on a plagued
  block. `GANODERMA.plagueSpreadFactor` is 1.6. One of the two is wrong.
- `TIMBER_VALUE.protected` prices timber for a biome that is never `clearable`,
  so it can never pay out. Harmless, and misleading to read.

## Hosting

- `edgeone.json` asks for `immutable` on all of `/assets/` and for the HSTS,
  `nosniff` and referrer headers. Check the live headers after the next
  deploy: on 2026-10-22 three hashed files (three.js, mobs, the preload
  helper's stylesheet) still came back `max-age=0, must-revalidate`, and no
  page carried the security headers. If the file is ignored, the same rules
  go in the EdgeOne console under the project's rule settings.

- `www.sawitsimulator.com` was added to the EdgeOne project on 2026-10-22 and
  `edgeone.json` redirects it to the apex. The host still served it with a
  `*.cdn.myqcloud.com` certificate that evening: the www row's HTTPS
  configuration in the console needs a certificate applied.
- The deploy runs from the host's own git build, which ships whatever compiles,
  tests or no tests. The workflow that deploys from CI after a green suite is
  written and parked; wiring it needs `EDGEONE_API_TOKEN` as a repository
  secret.
- `/play.html` carries `noindex`, so a shared game link can never rank. That was
  deliberate, the page being a boot shell, but it is worth revisiting if the
  game URL is what people pass around.

## Interface

- The certificate panel's footer still reads "Complete this to win the game"
  under the forest-win banner, which says the certificate is no longer the
  point. The footer should follow the band.
- The icon kit shipped `times.svg`, `speaker-low.svg` and five `hud-pin-*`
  icons that nothing uses yet.
