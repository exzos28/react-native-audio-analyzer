#----------------------------------------------------------------
# Generated CMake target import file for configuration "RelWithDebInfo".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "CpuFeatures::ndk_compat" for configuration "RelWithDebInfo"
set_property(TARGET CpuFeatures::ndk_compat APPEND PROPERTY IMPORTED_CONFIGURATIONS RELWITHDEBINFO)
set_target_properties(CpuFeatures::ndk_compat PROPERTIES
  IMPORTED_LINK_INTERFACE_LANGUAGES_RELWITHDEBINFO "C"
  IMPORTED_LOCATION_RELWITHDEBINFO "${_IMPORT_PREFIX}/lib/libndk_compat.a"
  )

list(APPEND _IMPORT_CHECK_TARGETS CpuFeatures::ndk_compat )
list(APPEND _IMPORT_CHECK_FILES_FOR_CpuFeatures::ndk_compat "${_IMPORT_PREFIX}/lib/libndk_compat.a" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
