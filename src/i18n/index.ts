/**
 * The game UI's localization: English and Indonesian message catalogs
 * (`locales/<locale>/<namespace>.json`), locale detection and a visitor's
 * own choice (`locale.svelte.ts`), and lookup (`t`).
 *
 * This is UI-owned text only: static labels, buttons, headers, help copy.
 * The sim layer generates its own English prose today (news headlines,
 * chronicle entries, a command's rejection reason) as part of its event
 * data, and none of it flows through here; translating that is a separate,
 * larger change to the sim's own contract, not attempted in this pass.
 */

export { LOCALES, locale, localeTag, setLocale, type Locale } from './locale.svelte.ts';
export { t } from './t.ts';
