#import "AudioAnalyzer.h"
#import "react-native-audio-analyzer.h"
#include <stdexcept>

@implementation AudioAnalyzer
RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(analyzeAudio:(NSString *)filename
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        audioanalyzer::FFmpegException ffmpegError = nullptr;

        const char *cFilename = [filename UTF8String];

        std::vector<audioanalyzer::AmplitudeData> result = audioanalyzer::analyzeAudio(cFilename, &ffmpegError);

        if (ffmpegError.getMessage()) {
            NSString *errorMessage = [NSString stringWithUTF8String:ffmpegError.getMessage()];
            reject(@"ffmpeg", errorMessage, nil);
            return;
        }

        NSMutableArray *outputArray = [NSMutableArray array];
        for (const auto &data : result) {
            NSDictionary *amplitudeData = @{
                @"amplitude": @(data.amplitude),
                @"timeInSeconds": @(data.timeInSeconds)
                // Other amplitude data
            };
            [outputArray addObject:amplitudeData];
        }

        resolve(outputArray);
    }
    @catch (...) {
        // Catch other exceptions and handle them accordingly
        reject(@"UnknownError", @"An unknown error occurred", nil);
    }
}

@end
