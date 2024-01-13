#include "react-native-audio-analyzer.h"
#include <vector>
#include <cmath>
#include <stdexcept>

extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
}

namespace audioanalyzer {

const char* FFmpegException::getMessage() const noexcept {
    return message;
}

std::vector<AmplitudeData> analyzeAudio(const char *filename, FFmpegException *errorPtr) {
    std::vector<AmplitudeData> amplitudeData;
    
    // Allocate memory for the AVFormatContext
    AVFormatContext *formatContext = avformat_alloc_context();
    if (!formatContext) {
        *errorPtr = FFmpegException("Failed to allocate AVFormatContext");
        return amplitudeData;
    }
    
    // Open the input file
    if (avformat_open_input(&formatContext, filename, nullptr, nullptr) != 0) {
        avformat_free_context(formatContext);
        *errorPtr = FFmpegException("Failed to open input file");
        return amplitudeData;
    }
    
    // Find stream information
    if (avformat_find_stream_info(formatContext, nullptr) < 0) {
        avformat_close_input(&formatContext);
        *errorPtr = FFmpegException("Failed to find stream information");
        return amplitudeData;
    }
    
    // Find the best audio stream
    int audioStreamIndex = av_find_best_stream(formatContext, AVMEDIA_TYPE_AUDIO, -1, -1, nullptr, 0);
    if (audioStreamIndex < 0) {
        avformat_close_input(&formatContext);
        *errorPtr = FFmpegException("Failed to find audio stream");
        return amplitudeData;
    }
    
    // Get codec parameters and find the corresponding decoder
    AVCodecParameters *codecParameters = formatContext->streams[audioStreamIndex]->codecpar;
    const AVCodec *codec = avcodec_find_decoder(codecParameters->codec_id);
    if (!codec) {
        avformat_close_input(&formatContext);
        *errorPtr = FFmpegException("Failed to find codec");
        return amplitudeData;
    }
    
    // Allocate memory for the AVCodecContext
    AVCodecContext *codecContext = avcodec_alloc_context3(codec);
    if (!codecContext) {
        avformat_close_input(&formatContext);
        *errorPtr = FFmpegException("Failed to allocate AVCodecContext");
        return amplitudeData;
    }
    
    // Set codec parameters
    if (avcodec_parameters_to_context(codecContext, codecParameters) < 0) {
        avformat_close_input(&formatContext);
        avcodec_free_context(&codecContext);
        *errorPtr = FFmpegException("Failed to set codec parameters");
        return amplitudeData;
    }
    
    // Open the codec
    if (avcodec_open2(codecContext, codec, nullptr) < 0) {
        avformat_close_input(&formatContext);
        avcodec_free_context(&codecContext);
        *errorPtr = FFmpegException("Failed to open codec");
        return amplitudeData;
    }
    
    // Allocate memory for AVPacket and AVFrame
    AVPacket packet;
    AVFrame *frame = av_frame_alloc();
    
    // Initialize variables for audio analysis
    int sampleRate = codecContext->sample_rate;
    double accumulatedAmplitude = 0.0;
    long sampleCount = 0;
    
    // Read frames from the input file
    while (av_read_frame(formatContext, &packet) >= 0) {
        if (packet.stream_index == audioStreamIndex) {
            // Send the packet to the codec
            if (avcodec_send_packet(codecContext, &packet) < 0) {
                break;
            }
            
            // Receive frames from the codec
            while (avcodec_receive_frame(codecContext, frame) >= 0) {
                double timestampInSeconds = frame->pts * av_q2d(formatContext->streams[audioStreamIndex]->time_base);
                
                // Calculate amplitude for each sample in the frame
                for (int i = 0; i < frame->nb_samples; i++) {
                    for (int ch = 0; ch < codecContext->ch_layout.nb_channels; ch++) {
                        if (frame->data[ch]) {
                            // Check if the index is within bounds
                            if (i < frame->linesize[ch]) {
                                accumulatedAmplitude += frame->data[ch][i];
                                sampleCount++;
                                
                                // Calculate amplitude per second and store the data
                                if (sampleCount >= sampleRate) {
                                    double amplitudePerSecond = accumulatedAmplitude / sampleRate;
                                    
                                    AmplitudeData data{};
                                    data.timeInSeconds = timestampInSeconds;
                                    data.amplitude = amplitudePerSecond;
                                    
                                    amplitudeData.push_back(data);
                                    
                                    accumulatedAmplitude = 0.0;
                                    sampleCount = 0;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Release the packet
        av_packet_unref(&packet);
    }
    
    // Clean up resources
    avformat_close_input(&formatContext);
    avcodec_free_context(&codecContext);
    av_frame_free(&frame);
    
    return amplitudeData;
}
}
