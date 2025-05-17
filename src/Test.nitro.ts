import type { HybridObject } from 'react-native-nitro-modules';

export interface Test extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  computeAmplitude(filePath: string, outputSampleCount: number): number[];
}
