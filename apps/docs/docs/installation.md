---
sidebar_position: 2
title: Installation
---

# Installation

```bash
npm install react-native-audio-analyzer react-native-nitro-modules
# or
yarn add react-native-audio-analyzer react-native-nitro-modules
```

[`react-native-nitro-modules`](https://nitro.margelo.com) is a required peer dependency.

## Bare React Native

```bash
cd ios && pod install
```

Android needs no extra steps. Rebuild the app afterwards; a JS reload is not enough to pick up native code.

## Expo

The library contains native code, so it does not run in Expo Go. Use a [development build](https://docs.expo.dev/develop/development-builds/introduction/):

```bash
npx expo install react-native-audio-analyzer react-native-nitro-modules
npx expo prebuild
npx expo run:ios     # or: npx expo run:android
```

No config plugin is needed.

## Compatibility

| | Version |
| --- | --- |
| react-native-nitro-modules | `^0.37.1` |
| Tested with | React Native 0.88, Expo SDK 58 (New Architecture) |
| Platforms | iOS, Android |

Older React Native versions supported by Nitro Modules 0.37 should work too, but are not covered by CI. The repository contains a [bare React Native app](https://github.com/exzos28/react-native-audio-analyzer/tree/main/apps/rn-cli-example) and an [Expo app](https://github.com/exzos28/react-native-audio-analyzer/tree/main/apps/expo-example) that are built on every change.
