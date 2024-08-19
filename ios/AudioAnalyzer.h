#ifdef __cplusplus
#import "react-native-audio-analyzer.h"
#endif

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNAudioAnalyzerSpec.h"

@interface AudioAnalyzer : NSObject <NativeAudioAnalyzerSpec>
#else
#import <React/RCTBridgeModule.h>

@interface AudioAnalyzer : NSObject <RCTBridgeModule>
#endif

- (void)analyzeAudio:(NSString *)filename
            groupBySeconds:(nonnull NSNumber *)groupBySeconds
             resolver:(RCTPromiseResolveBlock)resolve
             rejecter:(RCTPromiseRejectBlock)reject;

@end
