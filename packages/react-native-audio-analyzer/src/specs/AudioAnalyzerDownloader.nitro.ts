import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Downloads remote audio files into the app's cache directory.
 *
 * Implemented natively per platform (URLSession on iOS, HttpURLConnection on
 * Android). Use the wrappers exported from the package root instead.
 */
export interface AudioAnalyzerDownloader extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /**
   * Downloads `url` (http/https) into the cache unless it is already cached
   * and resolves with the absolute filesystem path of the cached file.
   * `headers` are sent with the request; they are not part of the cache key.
   */
  load(url: string, headers: Record<string, string>): Promise<string>;

  /** Deletes every cached file. */
  clearCache(): Promise<void>;

  /** Total size of the cached files in bytes. */
  getCacheSize(): Promise<number>;
}
