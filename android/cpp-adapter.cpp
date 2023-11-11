#include <jni.h>
#include <iostream>
#include "react-native-audio-analyzer.h"

extern "C"
JNIEXPORT jobjectArray JNICALL
Java_com_audioanalyzer_AudioAnalyzerModule_analyzeAudio(JNIEnv *env, jclass obj, jstring filePath) {

    // Step 1: Convert Java string to C++ string
    const char *nativeFilePath = env->GetStringUTFChars(filePath, nullptr);


    // Step 2: Call the analyzeAudio function
    audioanalyzer::FFmpegException errorPtr = nullptr;
    std::vector<audioanalyzer::AmplitudeData> amplitudeData = audioanalyzer::analyzeAudio(nativeFilePath, &errorPtr);


    if (errorPtr.getMessage()) {
        env->ThrowNew(env->FindClass("java/lang/Exception"), errorPtr.getMessage());
        env->ReleaseStringUTFChars(filePath, nativeFilePath);
        return nullptr;
    }

    // Step 3: Obtain information about the AmplitudeData class
    jclass amplitudeDataClass = env->FindClass("com/audioanalyzer/AmplitudeData");
    jmethodID amplitudeDataConstructor = env->GetMethodID(amplitudeDataClass, "<init>", "(DD)V");

    // Step 4: Create and populate an array of AmplitudeData objects
    jobjectArray resultArray = env->NewObjectArray(amplitudeData.size(), amplitudeDataClass, nullptr);
    for (size_t i = 0; i < amplitudeData.size(); ++i) {
        jobject amplitudeDataObject = env->NewObject(amplitudeDataClass, amplitudeDataConstructor, amplitudeData[i].timeInSeconds, amplitudeData[i].amplitude);
        env->SetObjectArrayElement(resultArray, i, amplitudeDataObject);
        env->DeleteLocalRef(amplitudeDataObject);  // Delete the local reference to the object (to avoid memory leaks)
    }

    // Step 5: Release resources
    env->ReleaseStringUTFChars(filePath, nativeFilePath);

    return resultArray;
}
