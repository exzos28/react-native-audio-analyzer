#include <jni.h>
#include "react-native-audio-analyzer.h"

extern "C"
JNIEXPORT jdouble JNICALL
Java_com_audioanalyzer_AudioAnalyzerModule_nativeMultiply(JNIEnv *env, jclass type, jdouble a, jdouble b) {
    return audioanalyzer::multiply(a, b);
}
