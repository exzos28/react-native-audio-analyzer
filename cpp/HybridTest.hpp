#include "HybridTestSpec.hpp"
#include <string>
#include <vector>

namespace margelo::nitro::test {
    struct HybridTest: public HybridTestSpec {
        HybridTest() : HybridObject(TAG) {}
        std::vector<double> computeAmplitude(const std::string& filePath, double samplesPerBlock) override;

        bool decodeAudioFile(const std::string& filePath, std::vector<float>& pcmData, unsigned int& sampleRate);
    };
}

