#import <React/RCTBridge+Private.h>
#import <jsi/jsi.h>

#import "AudioAnalyzer.h"

using namespace facebook;

@implementation AudioAnalyzer

RCT_EXPORT_MODULE(AudioAnalyzer)

#pragma mark - Lifecycle
+ (BOOL)requiresMainQueueSetup {
    return YES;
}

#pragma mark - Core

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
    AudioAnalyzer *__weak weakSelf = self;
    RCTBridge *bridge = self.bridge;
    
    if (bridge == nullptr) {
        return @false;
    }

    registerAudioAnalyzerHostObject(bridge, weakSelf);

    return @true;
}

void registerAudioAnalyzerHostObject(RCTBridge* bridge, AudioAnalyzer* weakSelf) {
    std::shared_ptr<react::CallInvoker> callInvoker = bridge.jsCallInvoker;
    jsi::Runtime* runtime = reinterpret_cast<jsi::Runtime*>(bridge.runtime);
    auto analyzerRuntime = std::make_shared<AnalyzerRuntime>(*runtime, callInvoker);

    auto hostObject = jsi::Object::createFromHostObject(*runtime, analyzerRuntime);

    runtime->global().setProperty(*runtime, "__EXZOS_ANALYZER__", std::move(hostObject));
}

@end

#pragma mark - End
