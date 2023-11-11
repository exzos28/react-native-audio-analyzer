#----------------------------------------------------------------
# Generated CMake target import file for configuration "RelWithDebInfo".
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "CpuFeatures::cpu_features" for configuration "RelWithDebInfo"
set_property(TARGET CpuFeatures::cpu_features APPEND PROPERTY IMPORTED_CONFIGURATIONS RELWITHDEBINFO)
set_target_properties(CpuFeatures::cpu_features PROPERTIES
  IMPORTED_LINK_INTERFACE_LANGUAGES_RELWITHDEBINFO "C"
  IMPORTED_LOCATION_RELWITHDEBINFO "${_IMPORT_PREFIX}/lib/libcpu_features.a"
  )

list(APPEND _IMPORT_CHECK_TARGETS CpuFeatures::cpu_features )
list(APPEND _IMPORT_CHECK_FILES_FOR_CpuFeatures::cpu_features "${_IMPORT_PREFIX}/lib/libcpu_features.a" )

# Import target "CpuFeatures::list_cpu_features" for configuration "RelWithDebInfo"
set_property(TARGET CpuFeatures::list_cpu_features APPEND PROPERTY IMPORTED_CONFIGURATIONS RELWITHDEBINFO)
set_target_properties(CpuFeatures::list_cpu_features PROPERTIES
  IMPORTED_LOCATION_RELWITHDEBINFO "${_IMPORT_PREFIX}/bin/list_cpu_features"
  )

list(APPEND _IMPORT_CHECK_TARGETS CpuFeatures::list_cpu_features )
list(APPEND _IMPORT_CHECK_FILES_FOR_CpuFeatures::list_cpu_features "${_IMPORT_PREFIX}/bin/list_cpu_features" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
