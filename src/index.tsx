import { NitroModules } from 'react-native-nitro-modules';
import type { Test } from './Test.nitro';

const TestHybridObject =
  NitroModules.createHybridObject<Test>('Test');

export function multiply(a: number, b: number): number {
  return TestHybridObject.multiply(a, b);
}
