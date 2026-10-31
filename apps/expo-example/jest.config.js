module.exports = {
  preset: 'jest-expo',
  testEnvironmentOptions: {
    // Resolve the library from source, like Metro does.
    customExportConditions: [
      'require',
      'react-native',
      'react-native-audio-analyzer-source',
    ],
  },
  // The library source lives outside this app and would otherwise resolve
  // the copy of React hoisted to the monorepo root. Like Metro (see
  // metro.config.js), always use this app's copy.
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
  },
};
