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
