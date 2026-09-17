import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import importX from 'eslint-plugin-import-x';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

/** `boundaries` entity selector for a layer. */
const layer = (type) => ({ element: { type } });

/** One "this layer may import these layers" policy. */
const policy = (from, allowed) => ({
  from: layer(from),
  allow: allowed.map((type) => ({ to: layer(type) })),
});

const BOUNDARY_ELEMENTS = [
  { type: 'app', pattern: 'src/app/**' },
  { type: 'ui', pattern: 'src/ui/**' },
  { type: 'render', pattern: 'src/render/**' },
  { type: 'input', pattern: 'src/input/**' },
  { type: 'persistence', pattern: 'src/persistence/**' },
  { type: 'workers', pattern: 'src/workers/**' },
  { type: 'sim', pattern: 'src/sim/**' },
  { type: 'shared', pattern: 'src/shared/**' },
];

const BOUNDARY_POLICIES = [
  policy('app', ['ui', 'render', 'input', 'persistence', 'workers', 'sim', 'shared']),
  policy('ui', ['sim', 'shared']),
  policy('render', ['sim', 'shared', 'workers']),
  policy('input', ['sim', 'shared', 'render']),
  policy('persistence', ['sim', 'shared']),
  // The mesher worker is render code that happens to run off-thread.
  policy('workers', ['render', 'sim', 'shared']),
  policy('sim', ['shared']),
  // `shared` is intentionally absent: default 'disallow' keeps it leaf-level.
];

/**
 * Layer rule (design doc §4.1): arrows point down only.
 *
 *   app  -> ui, render, input, persistence, sim, shared
 *   ui   -> sim (read-only), shared
 *   render / input / persistence / workers -> sim (read-only), shared
 *   sim  -> shared ONLY. Never three, never DOM, never timers.
 *   shared -> nothing
 *
 * `render/` and `ui/` may not import each other; they meet in `app/`.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Base ────────────────────────────────────────────────────────────────
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    plugins: { 'import-x': importX, boundaries },
    settings: {
      'import-x/resolver': { typescript: { project: './tsconfig.json' } },
      // `src/main.ts` is deliberately unclassified: it is the three-line
      // bootstrap that mounts `app/`, and `boundaries` classifies folders.
      'boundaries/include': ['src/**/*.ts'],
      'boundaries/elements': BOUNDARY_ELEMENTS,
    },
    rules: {
      'import-x/no-cycle': ['error', { maxDepth: Infinity }],
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',

      // The architecture rule.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message: "'{{from.type}}' may not import '{{to.type}}' (design doc \u00a74.1)",
          policies: BOUNDARY_POLICIES,
        },
      ],
      'boundaries/no-unknown-files': 'off',
      'boundaries/no-unknown': 'off',
    },
  },

  // ── Svelte components (ui/ only) ─────────────────────────────────────────
  // Syntactic checks only (import order, the layer boundary): type-aware
  // rules need a project service `svelte-check` already provides, and
  // running both would just duplicate work.
  ...svelte.configs.recommended,
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
      globals: { ...globals.browser },
    },
    plugins: { 'import-x': importX, boundaries },
    settings: {
      'import-x/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/include': ['src/**/*.svelte'],
      'boundaries/elements': BOUNDARY_ELEMENTS,
    },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message: "'{{from.type}}' may not import '{{to.type}}' (design doc \u00a74.1)",
          policies: BOUNDARY_POLICIES,
        },
      ],
      'boundaries/no-unknown-files': 'off',
      'boundaries/no-unknown': 'off',
      // The kit's own components are all-lowercase, single-word file names
      // ("phone", not "Phone") mixed with PascalCase panels; not worth a rule.
      'svelte/valid-compile': 'error',
    },
  },

  // ── `.svelte.ts` / `.svelte.js` modules ─────────────────────────────────
  // Svelte 5 runes (`$state`, `$derived`) work outside a `.svelte` file in a
  // module named `*.svelte.ts`; `eslint-plugin-svelte`'s own setup for these
  // sets a parser but not what it hands TS syntax to, so it chokes on
  // ordinary `import { type X } from` and worse. Point it at the real one.
  {
    files: ['**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // ── sim/ is pure: no Three.js, no DOM, no wall clock, no timers ─────────
  {
    files: ['src/sim/**/*.ts'],
    languageOptions: {
      globals: {},
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'three', message: 'sim/ must stay renderer-free (design doc §4.1).' },
            { name: 'mitt', message: 'sim/ returns event arrays; it does not emit (§10.2).' },
          ],
          patterns: [
            { group: ['three/*'], message: 'sim/ must stay renderer-free (design doc §4.1).' },
            { group: ['**/render/*', '**/ui/*', '**/app/*'], message: 'Upward import (§4.1).' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'sim/ must not touch the DOM (§4.1).' },
        { name: 'document', message: 'sim/ must not touch the DOM (§4.1).' },
        { name: 'localStorage', message: 'Saving belongs in persistence/ (§7).' },
        { name: 'performance', message: 'Wall-clock lives in app/loop.ts only (§4.3).' },
        { name: 'requestAnimationFrame', message: 'sim/ is tick-driven, not frame-driven (§4.3).' },
        { name: 'setTimeout', message: 'sim/ owns no timers (§4.1).' },
        { name: 'setInterval', message: 'sim/ owns no timers (§4.1).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'No wall-clock in sim/ (§4.3).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression > MemberExpression[object.object.name='Math'][object.property.name='random']",
          message: 'Use the seeded RNG in sim/rng.ts (§4.3).',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'Use the seeded RNG in sim/rng.ts (§4.3).',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'No wall-clock in sim/ (§4.3).',
        },
      ],
    },
  },

  // ── Node-side files ─────────────────────────────────────────────────────
  {
    files: ['*.config.ts', 'tools/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  // ── Tests ───────────────────────────────────────────────────────────────
  {
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'boundaries/element-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
