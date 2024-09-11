cmake_minimum_required(VERSION 3.9.0)

project(simple)


set (BUILD_DIR ${CMAKE_SOURCE_DIR}/build)
set (FFMPEG_DIR ${BUILD_DIR}/ffmpeg)
set (FFMPEG_SO_DIR ${FFMPEG_DIR}/ffmpeg-built-6.1)
set (FFMPEG_ARCH_DIR ${FFMPEG_SO_DIR}/${ANDROID_ABI})
set (FFMPEG_HEADERS ${FFMPEG_DIR}/ffmpeg-headers-5.1/include)

add_library(simple
        SHARED
        ../cpp/AudioAnalyzer.cpp
        ../cpp/AnalyzerRuntime.cpp
        cpp-adapter.cpp
)

include_directories(
        ../cpp
        ${FFMPEG_HEADERS}
)

set_target_properties(simple PROPERTIES
        CXX_STANDARD 20
        CXX_STANDARD_REQUIRED ON
        CXX_EXTENSIONS OFF
        POSITION_INDEPENDENT_CODE ON
)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

target_link_libraries(simple
        ReactAndroid::jsi
        ReactAndroid::turbomodulejsijni
        ReactAndroid::react_nativemodule_core
        android
        fbjni::fbjni
)

include_directories(${FFMPEG_ARCH_DIR}/include)

add_library(avcodec SHARED IMPORTED)
add_library(avformat SHARED IMPORTED)
add_library(avutil SHARED IMPORTED)
add_library(swresample SHARED IMPORTED)

set_target_properties(avcodec PROPERTIES IMPORTED_LOCATION ${FFMPEG_ARCH_DIR}/libavcodec.so)
set_target_properties(avformat PROPERTIES IMPORTED_LOCATION ${FFMPEG_ARCH_DIR}/libavformat.so)
set_target_properties(avutil PROPERTIES IMPORTED_LOCATION ${FFMPEG_ARCH_DIR}/libavutil.so)
set_target_properties(swresample PROPERTIES IMPORTED_LOCATION ${FFMPEG_ARCH_DIR}/libswresample.so)

target_link_libraries(simple avcodec avformat avutil swresample log)
