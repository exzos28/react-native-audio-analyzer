import React, { useEffect, useState } from 'react';

import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { analyzeAudio, scale, sample } from 'react-native-audio-analyzer';
import type { AmplitudeData } from 'react-native-audio-analyzer';

export default function App() {
  const [result, setResult] = useState<AmplitudeData[]>([]);

  useEffect(() => {
    analyzeAudio('<file uri>')
      .then((res) => {
        setResult(res);
      })
      .catch((err) => {
        if (err instanceof Error) {
          console.log(err);
          Alert.alert('Error', err.message);
        }
      });
  }, []);

  return (
    <View style={styles.container}>
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
