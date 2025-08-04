# react-native-audio-analyzer 🎵

A powerful library designed for React Native to visualize audio tracks, extract amplitude data, and create stunning audio waveforms.

This package offers robust tools that enable developers to process audio files efficiently, obtaining amplitude arrays for in-depth analysis or creating visually appealing audio waveforms within React Native applications.

## Create Stunning Audio Waveforms 🌊

With this library, unleash creativity by generating captivating audio waveforms from your audio tracks, providing an engaging visual representation of sound.

<img src="images/image.png" width="300" alt='Audio Waveform Example'>

## Features ✨

- **Audio Analysis**: Easily analyze audio tracks to obtain amplitude data for visualization or analysis purposes
- **Flexible Visualization**: Visualize amplitude data in a customizable manner, allowing developers to create diverse representations based on audio characteristics, including stunning audio waveforms
- **Sample and Scale Data**: Utilize functions to sample and scale amplitude data, providing more granular control over visualization output
- **Platform Compatibility**: Compatible with both Android and iOS platforms, ensuring a consistent experience across devices
- **High Performance**: Built with C++ and miniaudio library for optimal performance
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions

## Installation 🚀

```bash
npm install react-native-audio-analyzer react-native-nitro-modules
# or
yarn add react-native-audio-analyzer react-native-nitro-modules
```

> **Note**: `react-native-nitro-modules` is required as this library relies on [Nitro Modules](https://nitro.margelo.com/).

### iOS Setup

```bash
cd ios && pod install
# or
bundle exec pod install
```

## Usage 🎶

### Basic Usage

```typescript
import { computeAmplitude } from 'react-native-audio-analyzer';

// Analyze audio file and get amplitude data
const amplitudeData = computeAmplitude('/path/to/audio.mp3', 1000);
console.log('Amplitude data:', amplitudeData);
```

### Creating Audio Waveforms

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { computeAmplitude } from 'react-native-audio-analyzer';

export default function AudioWaveform() {
  const [amplitudeData, setAmplitudeData] = useState<number[]>([]);

  const analyzeAudio = useCallback(async () => {
    try {
      const result = computeAmplitude(
        '/path/to/your/audio.mp3',
        1000 // Number of amplitude samples to generate
      );
      setAmplitudeData(result);
    } catch (error) {
      console.error('Error analyzing audio:', error);
    }
  }, []);

  useEffect(() => {
    analyzeAudio();
  }, [analyzeAudio]);

  return (
    <ScrollView horizontal contentContainerStyle={styles.container}>
      <View style={styles.waveform}>
        {amplitudeData.map((amplitude, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              { height: 500 * amplitude } // Scale the height based on amplitude
            ]}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 1,
  },
  bar: {
    width: 3,
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
});
```

### Advanced Usage

```typescript
import { computeAmplitude } from 'react-native-audio-analyzer';

// Customize the number of amplitude samples
const highResolution = computeAmplitude('/audio.mp3', 2000); // More detailed
const lowResolution = computeAmplitude('/audio.mp3', 100);   // Less detailed

// Process the amplitude data for different visualizations
const normalizedData = highResolution.map(amplitude =>
  Math.min(amplitude * 100, 1.0) // Normalize to 0-1 range
);

// Create different visualization styles
const createWaveform = (data: number[], style: 'bars' | 'line' | 'area') => {
  switch (style) {
    case 'bars':
      return data.map((amp, i) => ({ x: i, y: amp }));
    case 'line':
      return data.map((amp, i) => ({ x: i, y: amp }));
    case 'area':
      return data.map((amp, i) => ({ x: i, y: amp, height: amp }));
  }
};
```

## API Reference 📚

### `computeAmplitude(filePath: string, outputSampleCount: number): number[]`

Analyzes an audio file and returns an array of amplitude values.

#### Parameters

- `filePath` (string): Path to the audio file to analyze
- `outputSampleCount` (number): Number of amplitude samples to generate

#### Returns

- `number[]`: Array of amplitude values between 0 and 1

#### Example

```typescript
const amplitudes = computeAmplitude('/path/to/song.mp3', 500);
// Returns: [0.1, 0.3, 0.5, 0.2, ...] (500 values)
```

## Supported Audio Formats 🎼

This library supports various audio formats through the miniaudio library:

- **Lossy**: MP3, AAC, OGG Vorbis, Opus
- **Lossless**: FLAC, WAV, AIFF
- **Other**: WMA, M4A, and more

## Performance Considerations ⚡

- The library uses native C++ code for optimal performance
- Audio processing is done efficiently with minimal memory usage
- Large audio files are processed in chunks to maintain responsiveness
- Consider using appropriate `outputSampleCount` values based on your visualization needs

## Platform Support 📱

- ✅ iOS 12.0+
- ✅ Android API 21+
- ✅ React Native 0.70+

## Contributing 🤝

We welcome contributions! Please see our [contributing guide](CONTRIBUTING.md) to learn how to contribute to this repository and the development workflow.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/exzos28/react-native-audio-analyzer.git
cd react-native-audio-analyzer

# Install dependencies
yarn install

# Run the example app
yarn example
```

## License 📝

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects 🔗

- [react-native-nitro-modules](https://github.com/margelo/react-native-nitro-modules) - The underlying native module system
- [miniaudio](https://github.com/mackron/miniaudio) - The audio processing library

---

Made with ❤️ by the React Native community
