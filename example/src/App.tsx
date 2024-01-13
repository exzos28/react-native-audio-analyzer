import React, { useCallback, useState } from 'react';

import { Button, ScrollView, StyleSheet, View } from 'react-native';
import { analyzeAudio, scale, sample } from 'react-native-audio-analyzer';
import type { AmplitudeData } from 'react-native-audio-analyzer';
import ReactNativeBlobUtil from 'react-native-blob-util';

export default function App() {
  const [result, setResult] = useState<AmplitudeData[]>([]);

  const start = useCallback(async () => {
    try {
      const response = await ReactNativeBlobUtil.config({
        fileCache: true,
      }).fetch(
        'GET',
        'https://file-examples.com/storage/fe61380d0265a2c7a970ef9/2017/11/file_example_WAV_10MG.wav',
        {}
      );
      const path = response.path();
      const data = await analyzeAudio(path);
      setResult(data);
    } catch (error) {
      console.log(error);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Button title="Start" onPress={start} />
      <ScrollView horizontal style={styles.scroll}>
        <View style={styles.row}>
          {result.length > 0 &&
            scale(result.map((_) => _.amplitude)).map((value, index) => (
              <View
                key={index}
                style={[styles.item, { height: value * 100 }]}
              />
            ))}
        </View>
      </ScrollView>
      <ScrollView horizontal style={styles.scroll}>
        <View style={styles.row}>
          {result.length > 0 &&
            scale(
              sample(
                result.map((_) => _.amplitude),
                20
              )
            ).map((value, index) => (
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
