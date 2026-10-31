import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.venv/**', 'design/**', 'visual-diff-output/**',
    'qa/artifacts/**', 'qa/evidence/**', 'qa-artifacts/**', 'qa-uploads/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser },
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off' },
  },
];
