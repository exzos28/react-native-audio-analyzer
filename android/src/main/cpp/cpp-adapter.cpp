#include <jni.h>
#include "testOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::test::initialize(vm);
}
