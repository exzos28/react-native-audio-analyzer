# react-native-audio-analyzer

## Installation

```sh
yarn add react-native-audio-analyzer
cd ios && pod install
```

## Images

<p float="left">
  <img src="images/android.png" width="200"  alt="android"/>
  <img src="images/ios.png" width="200" alt="ios"/>
</p>


## Usage

```js
import React, { useState } from 'react';

import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { analyzeAudio, scale, sample, AmplitudeData } from 'react-native-audio-analyzer';

export default function App() {
  const [result, setResult] = useState<AmplitudeData[]>([]);

  useEffect(() => {
    analyzeAudio('<uri to audio file>')
      .then(res => setResult(res))
      .catch(err => {
        // handle error
      });
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView horizontal style={styles.scroll}>
        <View style={styles.row}>
          {result.length > 0 && scale(result.map(_ => _.amplitude)).map((value, index) => (
            <View
              key={index}
              style={[styles.item, { height: value * 100 }]}
            />
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal style={styles.scroll}>
        <View style={styles.row}>
          {result.length > 0 && scale(
            sample(result.map(_ => _.amplitude), 20)).map((value, index) => (
            <View
              key={index}
              style={[styles.item, { height: value * 100 }]}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT
