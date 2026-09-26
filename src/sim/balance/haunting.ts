/** The haunting's own stream: a ghost must never shift the weather (GDD 3.11). */
export const HAUNT_STREAM = 0x48415554;

/**
 * What planting over a mass grave brings down on the estate (GDD 3.11). The
 * stages are years since the grave was planted; each keeps what came before.
 */
export const HAUNT = {
  /** Earth and bone the crew turns up: what an exhumed hectare holds when it is cleared. */
  exhumedDebris: 30,
  /** Years after planting at which the haunting leaves the grave block for the whole estate. */
  spreadAfterYears: 2,
  /** ...and at which fruit starts going missing everywhere, not only on the grave. */
  deepenAfterYears: 4,
  /** Ghosts kept on the grave block itself, and how likely one more is each day it is short. */
  onGrave: { min: 2, max: 4 },
  graveAppearPerDay: 0.25,
  /** Once spread: ghosts anywhere on the estate, capped, and how likely one more is a day. */
  estateCap: 3,
  estateAppearPerDay: 0.06,
  /** Days a haunting ghost lingers before it fades; another takes its place. */
  stayDays: { min: 6, max: 18 },
  /** A round picked from a haunted block loses fruit this often, and this much of it. */
  missingChance: 0.5,
  missingShare: { min: 0.1, max: 0.35 },
  /** What the hired hands are worth once the ghosts walk the whole estate. */
  workerFactor: 0.5,
} as const;
