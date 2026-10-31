cmake_minimum_required(VERSION 3.13)
project(audioanalyzer C CXX)

set(PACKAGE_NAME audioanalyzer)
set(CMAKE_CXX_STANDARD 20)

# Shared C++ core, Nitro bindings and the miniaudio implementation unit.
# Non-recursive on purpose: cpp/tests/ is host-only.
file(GLOB CORE_SOURCES CONFIGURE_DEPENDS "../cpp/*.cpp" "../cpp/*.c")

add_library(${PACKAGE_NAME} SHARED
        src/main/cpp/cpp-adapter.cpp
        ${CORE_SOURCES}
)

# Gradle's cppFlags only reach C++ files, so in debug builds the miniaudio C
# implementation would be compiled at -O0, which makes MP3/FLAC decoding
# several times slower. Always optimize the decoder.
set_source_files_properties(../cpp/MiniaudioImplementation.c PROPERTIES COMPILE_OPTIONS "-O2")

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/audioanalyzer+autolinking.cmake)

# Set up local includes
include_directories("src/main/cpp" "../cpp")

# The platform decoder uses NDK media APIs newer than minSdk (API 28 for
# in-memory sources) behind __builtin_available checks.
target_compile_definitions(${PACKAGE_NAME} PRIVATE __ANDROID_UNAVAILABLE_SYMBOLS_ARE_WEAK__)
target_compile_options(${PACKAGE_NAME} PRIVATE -Werror=unguarded-availability)

find_library(LOG_LIB log)
find_library(MEDIANDK_LIB mediandk)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        ${MEDIANDK_LIB} # <-- MediaExtractor / MediaCodec (platform decoder)
        android # <-- Android core
)
