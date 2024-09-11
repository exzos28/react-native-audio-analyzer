#include <jni.h>
#include <jsi/jsi.h>
#include <map>
#include <ReactCommon/CallInvokerHolder.h>
#include "AnalyzerRuntime.h"

using namespace facebook;

static jobject unistylesModule = nullptr;

extern "C"
JNIEXPORT void JNICALL
Java_com_audioanalyzer_AudioAnalyzerModule_nativeInstall(JNIEnv *env, jobject thiz, jlong jsi, jobject callInvokerHolder) {
    auto runtime = reinterpret_cast<jsi::Runtime *>(jsi);

    auto callInvoker{
            jni::alias_ref<react::CallInvokerHolder::javaobject>{ reinterpret_cast<react::CallInvokerHolder::javaobject>(callInvokerHolder)} -> cthis() ->getCallInvoker()
    };

    std::shared_ptr<AnalyzerRuntime> analyzerRuntime = std::make_shared<AnalyzerRuntime>(*runtime, callInvoker);

    jsi::Object hostObject = jsi::Object::createFromHostObject(*runtime, analyzerRuntime);
    runtime->global().setProperty(*runtime, "__EXZOS_ANALYZER__", std::move(hostObject));
}
