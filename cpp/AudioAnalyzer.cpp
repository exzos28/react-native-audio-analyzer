#include "AudioAnalyzer.hpp"
#define MINIAUDIO_IMPLEMENTATION
#include "miniaudio.h"

#include <cmath>
#include <iostream>
#include <algorithm>
#include <android/log.h>

#define LOG_TAG "HybridAudioAnalyzer"

using namespace margelo::nitro::analyzer;

bool AudioAnalyzer::decodeAudioFile(const std::string& filePath, std::vector<float>& pcmData, unsigned int& sampleRate) {
    ma_decoder decoder;
    ma_decoder_config config = ma_decoder_config_init(ma_format_f32, 0, 0);
    ma_result file = ma_decoder_init_file(filePath.c_str(), &config, &decoder);
    if (file != MA_SUCCESS) {
        __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "Failed to init decoder for %s (error %d)", filePath.c_str(), file);
        std::cerr << "Failed to init decoder for " << filePath << std::endl;
        return false;
    }

    sampleRate = decoder.outputSampleRate;

    ma_uint64 totalFrames = 0;
    if (ma_decoder_get_length_in_pcm_frames(&decoder, &totalFrames) != MA_SUCCESS) {
        std::cerr << "Failed to get length in pcm frames" << std::endl;
        ma_decoder_uninit(&decoder);
        return false;
    }

    size_t totalSamples = static_cast<size_t>(totalFrames * decoder.outputChannels);
    pcmData.resize(totalSamples);

    ma_uint64 framesRead = 0;
    ma_result result = ma_decoder_read_pcm_frames(&decoder, pcmData.data(), totalFrames, &framesRead);
    ma_decoder_uninit(&decoder);

    if (result != MA_SUCCESS) {
        std::cerr << "Failed to read PCM frames" << std::endl;
        return false;
    }

    if (framesRead != totalFrames) {
        std::cerr << "Warning: Frames read (" << framesRead << ") != total frames (" << totalFrames << ")" << std::endl;
    }

    return framesRead > 0;
}


std::vector<double> AudioAnalyzer::computeAmplitude(const std::string& filePath, double outputSampleCount = 1000) {
    size_t outputSampleCountInt = static_cast<size_t>(outputSampleCount);
    std::vector<float> pcm;
    unsigned int sampleRate = 0;

    // Decode audio file into PCM data
    if (!decodeAudioFile(filePath, pcm, sampleRate)) {
        __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, "Failed to decode audio file for amplitude computation: %s", filePath.c_str());
        return {};
    }

    std::vector<double> result;

    size_t totalSamples = pcm.size();
    if (totalSamples == 0 || outputSampleCount == 0) {
        // Return empty result if no samples or zero output requested
        return result;
    }

    // Calculate base block size and remainder to evenly split PCM into outputSampleCount blocks
    size_t baseBlockSize = totalSamples / outputSampleCount;
    size_t remainder = totalSamples % outputSampleCountInt;

    size_t offset = 0;
    for (size_t i = 0; i < outputSampleCount; ++i) {
        // Distribute remainder samples to the first 'remainder' blocks for even split
        size_t currentBlockSize = baseBlockSize + (i < remainder ? 1 : 0);

        if (currentBlockSize == 0) {
            // If block size is zero (e.g., outputSampleCount > totalSamples), push zero amplitude
            result.push_back(0.0);
            continue;
        }

        double sum = 0.0;
        // Sum absolute values of samples in the current block
        for (size_t j = 0; j < currentBlockSize; ++j) {
            sum += std::abs(pcm[offset + j]);
        }
        // Compute average amplitude for the block
        double avg = sum / currentBlockSize;
        result.push_back(avg);

        // Move offset forward by current block size
        offset += currentBlockSize;
    }

    return result;
}
