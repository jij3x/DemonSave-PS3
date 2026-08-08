import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off', // CLI logs to stderr/stdout
      radix: ['error', 'always'],
    },
  },
  {
    ignores: ['node_modules/**'],
  },
];
