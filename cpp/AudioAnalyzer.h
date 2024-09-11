#ifndef AUDIOANALYZER_H
#define AUDIOANALYZER_H

#include <vector>
#include <string>

namespace audioanalyzer {
    struct AmplitudeData {
        double amplitude;
        double timeInSeconds;
    };

    class FFmpegException : public std::exception {
    private:
        std::string message;

    public:
        explicit FFmpegException(const char* msg) noexcept
                : message(msg) {}

        const char* what() const noexcept override {
            return message.c_str();
        }

        const std::string& getMessage() const noexcept {
            return message;
        }
    };

    std::vector<AmplitudeData> analyzeAudio(const std::string& filename, double groupBySeconds);
}

#endif // AUDIOANALYZER_H
