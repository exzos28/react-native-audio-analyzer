import { NativeModules } from 'react-native';
import type { AudioAnalyzerModule } from './AudioAnalyzerModule';
import type { AmplitudeData, AudioAnalyzerBridge } from './AudioAnalyzerBridge';

export const TestAppModule =
  NativeModules?.AudioAnalyzer as AudioAnalyzerModule;

TestAppModule.install();

// @ts-ignore
const bridge = global.__EXZOS_ANALYZER__ as unknown as AudioAnalyzerBridge;

/**
 * @deprecated Please, use default export instead.
 */
const analyzeAudio = bridge.analyze;

export type { AmplitudeData };

export { analyzeAudio };
export * from './helpers';
export default bridge;
