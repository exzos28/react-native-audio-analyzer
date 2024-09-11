#include "AudioAnalyzer.h"
#include <vector>
#include <cmath>
#include <stdexcept>

extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
}

namespace audioanalyzer {

std::vector<AmplitudeData> analyzeAudio(const std::string& filename, double groupBySeconds) {
    std::vector<AmplitudeData> amplitudeData;

    if (groupBySeconds <= 0) {
        throw FFmpegException("groupBySeconds must be greater than 0");
    }

    // Allocate memory for the AVFormatContext
    AVFormatContext *formatContext = avformat_alloc_context();
    if (!formatContext) {
        throw FFmpegException("Failed to allocate AVFormatContext");
    }

    // Open the input file
    if (avformat_open_input(&formatContext, filename.c_str(), nullptr, nullptr) != 0) {
        avformat_free_context(formatContext);
        throw FFmpegException("Failed to open input file");
    }

    // Find stream information
    if (avformat_find_stream_info(formatContext, nullptr) < 0) {
        avformat_close_input(&formatContext);
        throw FFmpegException("Failed to find stream information");
    }

    // Find the best audio stream
    int audioStreamIndex = av_find_best_stream(formatContext, AVMEDIA_TYPE_AUDIO, -1, -1, nullptr, 0);
    if (audioStreamIndex < 0) {
        avformat_close_input(&formatContext);
        throw FFmpegException("Failed to find audio stream");
    }

    // Get codec parameters and find the corresponding decoder
    AVCodecParameters *codecParameters = formatContext->streams[audioStreamIndex]->codecpar;
    const AVCodec *codec = avcodec_find_decoder(codecParameters->codec_id);
    if (!codec) {
        avformat_close_input(&formatContext);
        throw FFmpegException("Failed to find codec");
    }

    // Allocate memory for the AVCodecContext
    AVCodecContext *codecContext = avcodec_alloc_context3(codec);
    if (!codecContext) {
        avformat_close_input(&formatContext);
        throw FFmpegException("Failed to allocate AVCodecContext");
    }

    // Set codec parameters
    if (avcodec_parameters_to_context(codecContext, codecParameters) < 0) {
        avformat_close_input(&formatContext);
        avcodec_free_context(&codecContext);
        throw FFmpegException("Failed to set codec parameters");
    }

    // Open the codec
    if (avcodec_open2(codecContext, codec, nullptr) < 0) {
        avformat_close_input(&formatContext);
        avcodec_free_context(&codecContext);
        throw FFmpegException("Failed to open codec");
    }

    // Allocate memory for AVPacket and AVFrame
    AVPacket packet;
    AVFrame *frame = av_frame_alloc();

    // Initialize variables for audio analysis
    int sampleRate = codecContext->sample_rate;
    double accumulatedAmplitude = 0.0;
    long sampleCount = 0;
    double currentTimeGroup = 0.0;

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

                                // Calculate amplitude for the specified groupBySeconds
                                if ((timestampInSeconds - currentTimeGroup) >= groupBySeconds) {
                                    double amplitudePerGroup = accumulatedAmplitude / sampleCount;

                                    AmplitudeData data{};
                                    data.timeInSeconds = currentTimeGroup;
                                    data.amplitude = amplitudePerGroup;

                                    amplitudeData.push_back(data);

                                    accumulatedAmplitude = 0.0;
                                    sampleCount = 0;
                                    currentTimeGroup += groupBySeconds;
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
