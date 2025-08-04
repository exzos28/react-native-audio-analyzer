import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { computeAmplitude } from 'react-native-audio-analyzer';

export default function Index() {
  const [data, setData] = useState<number[]>([]);
  const run = useCallback(async () => {
    try {
      const result = computeAmplitude(
        '/data/data/audioanalyzer.example/files/sample.mp3',
        1000
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

  return (
    <ScrollView horizontal contentContainerStyle={styles.root}>
      <View style={styles.container}>
        {data.map((item, index) => (
          <View key={index} style={[styles.item, { height: 500 * item }]} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    columnGap: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    width: 3,
    backgroundColor: 'red',
  },
});
