# react-native-audio-analyzer 🎵

A powerful library designed for React Native to visualize audio tracks, extract amplitude data, and create stunning audio waveforms.

This package offers robust tools that enable developers to process audio files efficiently, obtaining amplitude arrays for in-depth analysis or creating visually appealing audio waveforms within React Native applications.

## Installation 🚀

```sh
yarn add react-native-audio-analyzer
cd ios && pod install
```

## Create Stunning Audio Waveforms 🌊

With this library, unleash creativity by generating captivating audio waveforms from your audio tracks, providing an engaging visual representation of sound.

<p float="left">
  <img src="images/image.png" width="200"  alt="android"/>
</p>

## Features ✨

- __Audio Analysis__: Easily analyze audio tracks to obtain amplitude data for visualization or analysis purposes.

- __Flexible Visualization__: Visualize amplitude data in a customizable manner, allowing developers to create diverse representations based on audio characteristics, including stunning audio waveforms.

- __Sample and Scale Data__: Utilize functions to sample and scale amplitude data, providing more granular control over visualization output.

- __Platform Compatibility__: Compatible with both Android and iOS platforms, ensuring a consistent experience across devices.


## Usage 🎶

```js
import React, { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  analyzeAudio,
  scale,
  sample,
  robustScale,
  trimmedScale,
} from 'react-native-audio-analyzer';
import type { AmplitudeData } from 'react-native-audio-analyzer';
import ReactNativeBlobUtil from 'react-native-blob-util';

export default function App() {
  const [result, setResult] = useState<AmplitudeData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const start = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
      }).fetch(
        'GET',
        'https://github.com/rafaelreis-hotmart/Audio-Sample-files/raw/master/sample.mp3',
        {}
      );
      const path = response.path();
      const data = await analyzeAudio(path, 2);
      setResult(data);
    } catch (error) {
      Alert.alert('Error', String(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const amplitudes = result.map((_) => _.amplitude);

  const results = [
    {
      title: 'Trimmed scale:',
      data: trimmedScale(amplitudes).map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
    {
      title: 'Robust scale:',
      data: robustScale(amplitudes).map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
    {
      title: 'Scale + sample:',
      data: scale(sample(amplitudes, 35)).map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
    {
      title: 'Scale:',
      data: scale(amplitudes).map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
  ];

  return (
    <View style={styles.container}>
      <Button title="Start" onPress={start} />
      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <View>
          {results.map((_, index) => (
            <View style={styles.example} key={index}>
              <Text style={styles.title}>{_.title}</Text>
              <ScrollView horizontal style={styles.scroll}>
                <View style={styles.row}>{_.data}</View>
              </ScrollView>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  loader: {
    padding: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    marginBottom: 5,
  },
  example: {
    padding: 10,
  },
  scroll: {
    maxHeight: 200,
  },
  item: {
    width: 3,
    backgroundColor: 'blue',
    marginHorizontal: 2,
  },
});


```

## Contributing 🤝
We welcome [contributions](CONTRIBUTING.md)! Learn more about how to contribute to this repository by checking out our contributing guide and development workflow.

## License 📝
This project is licensed under the MIT License.

