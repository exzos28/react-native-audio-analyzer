import { useCallback, useEffect, useState } from 'react';

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeAmplitude } from 'react-native-audio-analyzer';
import { robustScale, sample, scale, trimmedScale } from '../../src/helpers';

export default function App() {
  const [data, setData] = useState<number[]>([]);

  const run = useCallback(async () => {
    try {
      const result = computeAmplitude(
        '/data/data/audioanalyzer.example/files/sample.mp3',
        100
      );
      setData(result);
    } catch (raw) {
      console.log(raw);
    }
  }, []);

  useEffect(() => {
    // noinspection JSIgnoredPromiseFromCall
    run();
  }, [run]);

  const results = [
    {
      title: 'Original:',
      data: data.map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
    {
      title: 'Trimmed scale:',
      data: trimmedScale(data, 0, 1).map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
    {
      title: 'Robust scale:',
      data: robustScale(data, 0, 1).map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
    {
      title: 'Scale + sample:',
      data: scale(sample(data, 35)).map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
    {
      title: 'Scale:',
      data: scale(data).map((value, index) => (
        <View key={index} style={[styles.item, { height: value * 100 }]} />
      )),
    },
  ];

  return (
    <View style={styles.container}>
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
