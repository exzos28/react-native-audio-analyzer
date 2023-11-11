package com.audioanalyzer;

public class AmplitudeData {
  private final double timeInSeconds;
  private final double amplitude;

  public AmplitudeData(double timeInSeconds, double amplitude) {
    this.timeInSeconds = timeInSeconds;
    this.amplitude = amplitude;
  }

  public double getTimeInSeconds() {
    return timeInSeconds;
  }

  public double getAmplitude() {
    return amplitude;
  }
}

