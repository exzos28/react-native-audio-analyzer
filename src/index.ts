import { NitroModules } from 'react-native-nitro-modules';
import type { Processor } from './Processor.nitro';
import type { FileSystem } from './FileSystem.nitro';

const AudioAnalyzerHybridObject =
  NitroModules.createHybridObject<Processor>('Processor');

const FileSystemHybridObject =
  NitroModules.createHybridObject<FileSystem>('FileSystem');

function computeAmplitude(filePath: string, outputSampleCount: number) {
  return AudioAnalyzerHybridObject.computeAmplitude(
    filePath,
    outputSampleCount
  );
}

function load(path: string) {
  return FileSystemHybridObject.load(path);
}

export { load, computeAmplitude };
