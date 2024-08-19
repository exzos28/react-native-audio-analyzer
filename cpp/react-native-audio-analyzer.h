#ifndef AUDIOANALYZER_H
#define AUDIOANALYZER_H

#include <vector>

namespace audioanalyzer {
    struct AmplitudeData {
        double amplitude;
        double timeInSeconds;
        // Other amplitude data
    };

    class FFmpegException {
    private:
        const char* message;

    public:
        FFmpegException(const char* msg) noexcept
                : message(msg) {}

        const char* getMessage() const noexcept;
    };

    std::vector<AmplitudeData> analyzeAudio(const char *filename, double groupBySeconds, FFmpegException *errorPtr);
}

#endif // AUDIOANALYZER_H
