#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <ReactCommon/CallInvoker.h>

#import <string>

@interface RCTBridge (BridgeWithRuntime)

- (void *)runtime;
- (std::shared_ptr<facebook::react::CallInvoker>)jsCallInvoker;

@end

@interface AudioAnalyzerModule : RCTEventEmitter<RCTBridgeModule>

@end
