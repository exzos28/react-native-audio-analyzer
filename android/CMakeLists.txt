project(test)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME test)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)
set(CACHE_DIR ${CMAKE_SOURCE_DIR}/build)

file(GLOB_RECURSE CORE_SRC RELATIVE ${CMAKE_SOURCE_DIR} "./src/main/cpp/*.cpp")
file(GLOB_RECURSE SOURCES RELATIVE ${CMAKE_SOURCE_DIR} "../cpp/*.cpp")

add_library(
        ${PACKAGE_NAME}
        SHARED
        ${CORE_SRC}
        ${SOURCES}
)

# Add Nitrogen specs :)
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/test+autolinking.cmake)

# Set up local includes
include_directories("src/main/cpp" "../cpp")

target_include_directories(${PACKAGE_NAME} PRIVATE "${CACHE_DIR}/download-cache")

find_library(LOG_LIB log)

# Link all libraries together
target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android # <-- Android core
)
