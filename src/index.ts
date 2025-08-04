import { NitroModules } from 'react-native-nitro-modules';
import type { AudioAnalyzer } from './AudioAnalyzer.nitro';

const AnalyzerHybridObject =
  NitroModules.createHybridObject<AudioAnalyzer>('AudioAnalyzer');

export function computeAmplitude(filePath: string, outputSampleCount: number) {
  return AnalyzerHybridObject.computeAmplitude(filePath, outputSampleCount);
}
