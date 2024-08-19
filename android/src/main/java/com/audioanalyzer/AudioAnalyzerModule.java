package com.audioanalyzer;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.module.annotations.ReactModule;

@ReactModule(name = AudioAnalyzerModule.NAME)
public class AudioAnalyzerModule extends ReactContextBaseJavaModule {
  public static final String NAME = "AudioAnalyzer";

  public AudioAnalyzerModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  static {
    System.loadLibrary("cpp");
  }

  private static native AmplitudeData[] analyzeAudio(String filepath, double groupBySeconds);

  @ReactMethod
  public void analyzeAudio(String filepath, double groupBySeconds, Promise promise) {
    try {
      AmplitudeData[] analyze = analyzeAudio(filepath, groupBySeconds);

      WritableArray resultArray = new WritableNativeArray();
      for (AmplitudeData data : analyze) {
        WritableMap dataMap = new WritableNativeMap();
        dataMap.putDouble("timeInSeconds", data.getTimeInSeconds());
        dataMap.putDouble("amplitude", data.getAmplitude());
        resultArray.pushMap(dataMap);
      }
      promise.resolve(resultArray);
    } catch (Exception e) {
      promise.reject(e);
    }
  }
}
