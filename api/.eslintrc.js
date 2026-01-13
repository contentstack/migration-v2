const path = require('path');

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'prettier',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    project: [path.resolve(__dirname, 'tsconfig.json')],
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    'operator-linebreak': [
      'error',
      'after',
      {
        overrides: {
          ':': 'before',
        },
      },
    ],
    'func-names': [0],
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};

