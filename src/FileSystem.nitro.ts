import type { HybridObject } from 'react-native-nitro-modules';

export interface FileSystem
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Downloads and caches the file.
   */
  load(path: string): Promise<string>;
}
