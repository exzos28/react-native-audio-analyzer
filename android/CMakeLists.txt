project(audioanalyzer)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME audioanalyzer)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

# Miniaudio compilation flags
add_definitions(-DMA_NO_PTHREAD_IN_HEADER=1)
set(CACHE_DIR ${CMAKE_SOURCE_DIR}/build)

file(GLOB_RECURSE CORE_SRC RELATIVE ${CMAKE_SOURCE_DIR} "./src/main/cpp/*.cpp")
file(GLOB_RECURSE SOURCES RELATIVE ${CMAKE_SOURCE_DIR} "../cpp/*.cpp")

# Add miniaudio source
set(MINIAUDIO_SRC "../libs/miniaudio/miniaudio.c")

add_library(
        ${PACKAGE_NAME}
        SHARED
        ${CORE_SRC}
        ${SOURCES}
        ${MINIAUDIO_SRC}
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/audioanalyzer+autolinking.cmake)

# Set up local includes
include_directories("src/main/cpp" "../cpp" "../libs/miniaudio")

target_include_directories(${PACKAGE_NAME} PRIVATE "${CACHE_DIR}/download-cache")

find_library(LOG_LIB log)
find_library(OPENSLES_LIB OpenSLES)
find_library(ANDROID_LIB android)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        ${OPENSLES_LIB}
        ${ANDROID_LIB}
)
