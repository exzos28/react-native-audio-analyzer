import { NitroModules } from 'react-native-nitro-modules';
import type { Analyzer } from './Analyzer.nitro';

const AnalyzerHybridObject =
  NitroModules.createHybridObject<Analyzer>('Analyzer');

export function computeAmplitude(filePath: string, outputSampleCount: number) {
  return AnalyzerHybridObject.computeAmplitude(filePath, outputSampleCount);
}
