#include <jni.h>
#include "audioanalyzerOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::audioanalyzer::initialize(vm);
}
