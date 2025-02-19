import { NativeModules } from 'react-native';
import type { AudioAnalyzerOnLoad } from './AudioAnalyzerOnLoad';
import type { AmplitudeData, AudioAnalyzerBridge } from './AudioAnalyzerBridge';

export const AudioAnalyzerModule =
  NativeModules?.AudioAnalyzerModule as AudioAnalyzerOnLoad;

AudioAnalyzerModule.install();

// @ts-ignore
const bridge = global.__EXZOS_ANALYZER__ as unknown as AudioAnalyzerBridge;

export type { AmplitudeData };

export * from './helpers';
export default bridge;
