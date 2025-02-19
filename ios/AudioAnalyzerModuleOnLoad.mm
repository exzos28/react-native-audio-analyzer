#import <React/RCTBridge+Private.h>
#import <jsi/jsi.h>

#import "AudioAnalyzerModuleOnLoad.h"
#import "AudioAnalyzer.h"
#import "AnalyzerRuntime.h"


using namespace facebook;

@implementation AudioAnalyzerModule

RCT_EXPORT_MODULE(AudioAnalyzerModule)

#pragma mark - Lifecycle
+ (BOOL)requiresMainQueueSetup {
    return YES;
}

#pragma mark - Core

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
    AudioAnalyzerModule *__weak weakSelf = self;
    RCTBridge *bridge = self.bridge;
    
    if (bridge == nullptr) {
        return @false;
    }

    registerAudioAnalyzerModuleHostObject(bridge, weakSelf);

    return @true;
}

void registerAudioAnalyzerModuleHostObject(RCTBridge* bridge, AudioAnalyzerModule* weakSelf) {
    std::shared_ptr<react::CallInvoker> callInvoker = bridge.jsCallInvoker;
    jsi::Runtime* runtime = reinterpret_cast<jsi::Runtime*>(bridge.runtime);
    auto analyzerRuntime = std::make_shared<AnalyzerRuntime>(*runtime, callInvoker);

    auto hostObject = jsi::Object::createFromHostObject(*runtime, analyzerRuntime);

    runtime->global().setProperty(*runtime, "__EXZOS_ANALYZER__", std::move(hostObject));
}

@end

#pragma mark - End
