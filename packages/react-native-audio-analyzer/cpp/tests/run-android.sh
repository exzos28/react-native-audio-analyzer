#!/bin/sh
# Builds the C++ tests for Android with the NDK and runs them on the connected
# device or emulator (adb), so the MediaCodec platform decoder is exercised on
# a real Android system.
#
#   sh cpp/tests/run-android.sh            # from packages/react-native-audio-analyzer
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
SDK=${ANDROID_HOME:-$HOME/Library/Android/sdk}
NDK=${ANDROID_NDK_HOME:-$(ls -d "$SDK"/ndk/* | sort -V | tail -1)}
ADB="$SDK/platform-tools/adb"
ABI=${ABI:-arm64-v8a}
DEVICE_DIR=/data/local/tmp/audioanalyzer-tests
BUILD="$HERE/build-android-$ABI"

cmake -S "$HERE" -B "$BUILD" \
  -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
  -DANDROID_ABI="$ABI" -DANDROID_PLATFORM=android-24 \
  -DCMAKE_BUILD_TYPE=Release -DAUDIOANALYZER_SANITIZE=OFF \
  -DAUDIOANALYZER_FIXTURES="$DEVICE_DIR/fixtures" >/dev/null
cmake --build "$BUILD" --target audioanalyzer_tests --parallel >/dev/null

"$ADB" shell "rm -rf $DEVICE_DIR && mkdir -p $DEVICE_DIR"
"$ADB" push "$HERE/fixtures" "$DEVICE_DIR/" >/dev/null
"$ADB" push "$BUILD/audioanalyzer_tests" "$DEVICE_DIR/" >/dev/null
"$ADB" shell "chmod +x $DEVICE_DIR/audioanalyzer_tests && cd $DEVICE_DIR && ./audioanalyzer_tests"
