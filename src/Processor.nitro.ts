import type { HybridObject } from 'react-native-nitro-modules';

export interface Processor
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  computeAmplitude(source: string, outputSampleCount: number): number[];
}
