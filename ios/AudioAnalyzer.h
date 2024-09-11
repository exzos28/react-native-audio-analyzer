#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#include "AnalyzerRuntime.h"

#import <string>

@interface RCTBridge (BridgeWithRuntime)

- (void *)runtime;
- (std::shared_ptr<facebook::react::CallInvoker>)jsCallInvoker;

@end

@interface AudioAnalyzer : RCTEventEmitter<RCTBridgeModule>

@end
