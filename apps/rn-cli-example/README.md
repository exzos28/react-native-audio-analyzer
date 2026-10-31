# React Native CLI example

A bare React Native app that uses `react-native-audio-analyzer` from this
monorepo (`workspace:*`, resolved from TypeScript sources by Metro).

From the repository root:

```sh
yarn && yarn nitrogen
yarn workspace rn-cli-example pods       # iOS: bundle install + pod install
yarn workspace rn-cli-example start
yarn workspace rn-cli-example ios        # or: android
```

`yarn workspace rn-cli-example test` runs the integration test in
`src/__tests__`, which renders the app against the real library code with only
the native layer mocked.
