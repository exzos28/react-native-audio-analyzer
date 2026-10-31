// Manual mock placed next to node_modules so that it replaces *every* copy of
// react-native-nitro-modules: the app resolves its own copy, while the library
// source (packages/react-native-audio-analyzer/src) resolves the one hoisted
// to the monorepo root. A jest.mock() factory inside the test file would only
// mock the copy resolved from the test file's location.
type MockHybridObject = Record<string, jest.Mock>;

const instances: Record<string, MockHybridObject> = {};

function createMock(name: string): MockHybridObject {
  switch (name) {
    case 'AudioAnalyzer':
      return { getInfo: jest.fn(), analyze: jest.fn(), cancel: jest.fn() };
    case 'AudioAnalyzerDownloader':
      return {
        load: jest.fn(),
        clearCache: jest.fn(),
        getCacheSize: jest.fn(),
      };
    default:
      throw new Error(`Unexpected hybrid object "${name}"`);
  }
}

export const NitroModules = {
  createHybridObject: jest.fn((name: string) => {
    instances[name] ??= createMock(name);
    return instances[name];
  }),
};
