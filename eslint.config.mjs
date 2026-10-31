import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import * as espree from 'espree';
import { defineConfig } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: fixupConfigRules(compat.extends('@react-native', 'prettier')),
    plugins: { prettier },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'prettier/prettier': 'error',
    },
  },
  {
    // Plain JS config files are not part of any Babel project: parse them
    // without looking up a Babel config.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      parserOptions: {
        requireConfigFile: false,
        babelOptions: { babelrc: false, configFile: false },
      },
    },
  },
  {
    files: ['**/*.mjs'],
    // Native ES modules (import.meta etc.): use ESLint's default parser.
    languageOptions: {
      parser: espree,
      sourceType: 'module',
      ecmaVersion: 'latest',
    },
  },
  {
    ignores: [
      '**/cpp/tests/build/**',
      '**/android/build/**',
      '**/cpp/tests/build-android-*/**',
      'apps/docs/build/**',
      'apps/docs/.docusaurus/**',
      'apps/docs/src/generated/**',
      'apps/docs/docs/api/**',
      '**/node_modules/**',
      '**/lib/**',
      '**/nitrogen/**',
      '**/coverage/**',
      '**/.expo/**',
      'apps/*/ios/**',
      'apps/*/android/**',
      'packages/*/libs/**',
      '.yarn/**',
    ],
  },
]);
