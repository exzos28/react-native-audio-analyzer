#!/bin/sh
# Prepares the waveform data shown on the docs site.
#
# Downloads public-domain recordings, analyzes them with the library's C++
# core (the same code that runs on devices) and stores the results as
# compact .peaks files in examples/. The audio itself is not committed.
#
# Needs CMake and a C++20 compiler. Run from the repository root:
#   yarn workspace docs examples:analyze
set -eu

DOCS_DIR=$(cd "$(dirname "$0")/.." && pwd)
LIB_DIR=$(cd "$DOCS_DIR/../../packages/react-native-audio-analyzer" && pwd)
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

cmake -S "$LIB_DIR/cpp/tests" -B "$LIB_DIR/cpp/tests/build" -DCMAKE_BUILD_TYPE=Release -DAUDIOANALYZER_SANITIZE=OFF >/dev/null
cmake --build "$LIB_DIR/cpp/tests/build" --target peaks_dump --parallel >/dev/null
DUMP="$LIB_DIR/cpp/tests/build/peaks_dump"

# name | url | maxBuckets | start | end
while IFS='|' read -r name url buckets start end; do
  [ -z "$name" ] && continue
  echo "→ $name"
  curl -sSfL "$url" -o "$WORK_DIR/$name.audio"
  "$DUMP" "$WORK_DIR/$name.audio" "$buckets" "$start" "$end" > "$WORK_DIR/$name.json"
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$DOCS_DIR/scripts/encode-peaks.mts" "$WORK_DIR/$name.json" "$DOCS_DIR/examples/$name.peaks"
done <<'LIST'
voice|https://archive.org/download/childrensshortworks025_1804_librivox/csw025_theantandthedove_hzf_64kb.mp3|2000|20|32
story|https://archive.org/download/childrensshortworks025_1804_librivox/csw025_theantandthedove_hzf_64kb.mp3|20000|0|end
music|https://raw.githubusercontent.com/mackron/miniaudio/0.11.25/data/16-44100-stereo.flac|20000|0|end
LIST
