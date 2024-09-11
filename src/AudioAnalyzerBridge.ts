export interface AudioAnalyzerBridge {
  multiply(a: number, b: number): number;
  analyze(filepath: string, groupBySeconds: number): AmplitudeData[];
}

export type AmplitudeData = {
  amplitude: number;
  timeInSeconds: number;
};
