import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Scopes are the layer names (design doc §10.2).
    'scope-enum': [
      2,
      'always',
      [
        'sim',
        'render',
        'ui',
        'app',
        'input',
        'persistence',
        'workers',
        'shared',
        'balance',
        'tools',
        'docs',
        'ci',
        'deps',
      ],
    ],
    'body-max-line-length': [0, 'always'],
  },
};

export default config;
