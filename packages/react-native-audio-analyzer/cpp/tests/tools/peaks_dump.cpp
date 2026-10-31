// Runs the library's C++ core on an audio file and prints the result as JSON
// in the shape of the JS `Peaks` type. Used to prepare data for the docs site:
//
//   peaks_dump <file> [maxBuckets] [startSeconds] [endSeconds | end]
#include "Analysis.hpp"

#include <cstdio>
#include <exception>
#include <string>

namespace {

void printArray(const char* name, const std::vector<float>& values, std::size_t from, std::size_t count, bool last) {
  std::printf("\"%s\":[", name);
  for (std::size_t i = 0; i < count; ++i) {
    std::printf(i ? ",%.7g" : "%.7g", static_cast<double>(values[from + i]));
  }
  std::printf("]%s", last ? "" : ",");
}

} // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: %s <file> [maxBuckets] [startSeconds] [endSeconds]\n", argv[0]);
    return 2;
  }
  try {
    audioanalyzer::AnalyzeOptions options;
    if (argc > 2) options.maxBuckets = std::stoull(argv[2]);
    if (argc > 3) options.startTime = std::stod(argv[3]);
    if (argc > 4 && std::string(argv[4]) != "end") options.endTime = std::stod(argv[4]);
    const auto result = audioanalyzer::analyze(std::string(argv[1]), options);
    const auto& peaks = result.peaks;
    std::printf("{\"sampleRate\":%u,\"framesPerBucket\":%llu,\"startFrame\":%llu,\"frameCount\":%llu,\"length\":%zu,"
                "\"channels\":[",
                result.sampleRate, static_cast<unsigned long long>(peaks.framesPerBucket),
                static_cast<unsigned long long>(result.startFrame), static_cast<unsigned long long>(peaks.frameCount),
                peaks.length);
    for (std::uint32_t channel = 0; channel < peaks.channels; ++channel) {
      std::printf(channel ? ",{" : "{");
      printArray("min", peaks.min, channel * peaks.length, peaks.length, false);
      printArray("max", peaks.max, channel * peaks.length, peaks.length, false);
      printArray("rms", peaks.rms, channel * peaks.length, peaks.length, true);
      std::printf("}");
    }
    std::printf("]}\n");
    return 0;
  } catch (const std::exception& error) {
    std::fprintf(stderr, "error: %s\n", error.what());
    return 1;
  }
}
