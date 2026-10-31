const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withMetroConfig } = require('react-native-monorepo-config');

const root = path.resolve(__dirname, '..', '..');

/**
 * Metro configuration for a monorepo app: watches the repository root,
 * resolves the library from its TypeScript sources (no build step needed)
 * and makes sure react, react-native and react-native-nitro-modules always
 * come from this app's node_modules.
 *
 * @type {import('metro-config').MetroConfig}
 */
module.exports = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
  conditions: ['react-native-audio-analyzer-source'],
});
