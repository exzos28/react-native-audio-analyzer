#include "HybridAnalyzerSpec.hpp"
#include <string>
#include <vector>

namespace margelo::nitro::analyzer {
    struct AudioAnalyzer: public HybridAnalyzerSpec {
        AudioAnalyzer() : HybridObject(TAG) {}
        std::vector<double> computeAmplitude(const std::string& filePath, double samplesPerBlock) override;

        bool decodeAudioFile(const std::string& filePath, std::vector<float>& pcmData, unsigned int& sampleRate);
    };
}

