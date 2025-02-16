export interface AudioAnalyzerBridge {
  analyze(filepath: string, groupBySeconds: number): AmplitudeData[];
}

export type AmplitudeData = {
  amplitude: number;
  timeInSeconds: number;
};
