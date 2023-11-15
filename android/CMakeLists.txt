cmake_minimum_required(VERSION 3.4.1)
project(react-native-audio-analyzer)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 11)

set (BUILD_DIR ${CMAKE_SOURCE_DIR}/build)
set (FFMPEG_DIR ${BUILD_DIR}/ffmpeg)
set (FFMPEG_SO_DIR ${FFMPEG_DIR}/ffmpeg-built-6.1)
set (FFMPEG_ARCH_DIR ${FFMPEG_SO_DIR}/${ANDROID_ABI})
set (FFMPEG_HEADERS ${FFMPEG_DIR}/ffmpeg-headers-5.1/include)

add_library(cpp
        SHARED
        ../cpp/react-native-audio-analyzer.cpp
        cpp-adapter.cpp
        )

include_directories(
        ../cpp
        ${FFMPEG_HEADERS}
)


message(STATUS "FFMPEG_ARCH_DIR: ${FFMPEG_ARCH_DIR}")


if(NOT EXISTS ${FFMPEG_ARCH_DIR})
  message(FATAL_ERROR "Directory ${FFMPEG_ARCH_DIR} does not exist")
endif()

include_directories(${FFMPEG_ARCH_DIR}/include)

add_library(avcodec SHARED IMPORTED)
add_library(avformat SHARED IMPORTED)
add_library(avutil SHARED IMPORTED)
add_library(swresample SHARED IMPORTED)

set_target_properties(avcodec PROPERTIES IMPORTED_LOCATION ${FFMPEG_ARCH_DIR}/libavcodec.so)
set_target_properties(avformat PROPERTIES IMPORTED_LOCATION ${FFMPEG_ARCH_DIR}/libavformat.so)
set_target_properties(avutil PROPERTIES IMPORTED_LOCATION ${FFMPEG_ARCH_DIR}/libavutil.so)
set_target_properties(swresample PROPERTIES IMPORTED_LOCATION ${FFMPEG_ARCH_DIR}/libswresample.so)

target_link_libraries(cpp avcodec avformat avutil swresample log)
