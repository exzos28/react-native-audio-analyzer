# Host-side unit tests for the platform-independent C++ core.
#
#   yarn workspace react-native-audio-analyzer test:cpp
#
# Builds with AddressSanitizer and UndefinedBehaviorSanitizer so out-of-bounds
# reads and integer edge cases fail loudly.
cmake_minimum_required(VERSION 3.16)
project(audioanalyzer_tests C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CORE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/..)

option(AUDIOANALYZER_SANITIZE "Build tests with ASan and UBSan" ON)
set(SANITIZER_FLAGS -fsanitize=address,undefined -fno-omit-frame-pointer -fno-sanitize-recover=all)

# miniaudio is third-party code: build it separately without our warning flags.
add_library(miniaudio STATIC ${CORE_DIR}/MiniaudioImplementation.c)

add_executable(audioanalyzer_tests
        main.cpp
        PeaksAccumulatorTests.cpp
        AnalysisTests.cpp
        FormatTests.cpp
        PlatformFormatTests.cpp
        ${CORE_DIR}/Analysis.cpp
        ${CORE_DIR}/AudioDecoder.cpp
        ${CORE_DIR}/BuiltinDecoder.cpp
        ${CORE_DIR}/PlatformDecoderApple.cpp
        ${CORE_DIR}/PlatformDecoderAndroid.cpp
        ${CORE_DIR}/PlatformDecoderFallback.cpp
)
target_include_directories(audioanalyzer_tests PRIVATE ${CORE_DIR})
# Small generated audio files (0.5 s, 440 Hz sine at amplitude 0.5). On
# Android the tests run on a device, where run-android.sh pushes them.
set(AUDIOANALYZER_FIXTURES "${CMAKE_CURRENT_SOURCE_DIR}/fixtures" CACHE STRING "Directory with the test fixtures")
target_compile_definitions(audioanalyzer_tests PRIVATE AUDIOANALYZER_FIXTURES="${AUDIOANALYZER_FIXTURES}")
target_compile_options(audioanalyzer_tests PRIVATE -Wall -Wextra -Wpedantic -Werror)
target_link_libraries(audioanalyzer_tests PRIVATE miniaudio)

if(UNIX AND NOT APPLE)
  target_link_libraries(miniaudio PRIVATE m dl)
endif()
# The platform decoder on macOS uses the same AudioToolbox API as iOS.
if(APPLE)
  set(PLATFORM_LIBS "-framework AudioToolbox" "-framework CoreFoundation")
  target_link_libraries(audioanalyzer_tests PRIVATE ${PLATFORM_LIBS})
elseif(ANDROID)
  set(PLATFORM_LIBS mediandk)
  target_link_libraries(audioanalyzer_tests PRIVATE ${PLATFORM_LIBS})
  target_compile_definitions(audioanalyzer_tests PRIVATE __ANDROID_UNAVAILABLE_SYMBOLS_ARE_WEAK__)
endif()

if(AUDIOANALYZER_SANITIZE)
  foreach(target miniaudio audioanalyzer_tests)
    target_compile_options(${target} PRIVATE ${SANITIZER_FLAGS})
    target_link_options(${target} PRIVATE ${SANITIZER_FLAGS})
  endforeach()
endif()

enable_testing()
add_test(NAME audioanalyzer_tests COMMAND audioanalyzer_tests)

# Command-line tool that prints the analysis of a file as JSON (docs data).
add_executable(peaks_dump tools/peaks_dump.cpp ${CORE_DIR}/Analysis.cpp ${CORE_DIR}/AudioDecoder.cpp
        ${CORE_DIR}/BuiltinDecoder.cpp ${CORE_DIR}/PlatformDecoderApple.cpp ${CORE_DIR}/PlatformDecoderAndroid.cpp
        ${CORE_DIR}/PlatformDecoderFallback.cpp)
if(ANDROID)
  target_compile_definitions(peaks_dump PRIVATE __ANDROID_UNAVAILABLE_SYMBOLS_ARE_WEAK__)
endif()
target_include_directories(peaks_dump PRIVATE ${CORE_DIR})
target_link_libraries(peaks_dump PRIVATE miniaudio ${PLATFORM_LIBS})
if(AUDIOANALYZER_SANITIZE)
  target_compile_options(peaks_dump PRIVATE ${SANITIZER_FLAGS})
  target_link_options(peaks_dump PRIVATE ${SANITIZER_FLAGS})
endif()
