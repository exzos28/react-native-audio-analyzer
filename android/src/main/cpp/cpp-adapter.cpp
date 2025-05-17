#include <jni.h>
#include "analyzerOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::analyzer::initialize(vm);
}
