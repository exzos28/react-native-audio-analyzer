require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Run the miniaudio preparation script
script_path = File.join(__dir__, "scripts", "prepare_miniaudio.rb")
if File.exist?(script_path)
  system("ruby #{script_path}")
else
  puts "Warning: Miniaudio preparation script not found at #{script_path}"
end

Pod::Spec.new do |s|
  s.name         = "AudioAnalyzer"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/exzos28/react-native-audio-analyzer.git", :tag => "#{s.version}" }

  # Use pod_target_xcconfig instead of compiler_flags
  s.pod_target_xcconfig = {
    # C++ compiler flags for miniaudio on iOS
    'GCC_PREPROCESSOR_DEFINITIONS' => 'MA_NO_PTHREAD_IN_HEADER=1',
    'OTHER_CFLAGS' => '-DMA_NO_PTHREAD_IN_HEADER',
    'OTHER_LDFLAGS' => '-lm -lpthread',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++11',
    'CLANG_CXX_LIBRARY' => 'libstdc++'
  }

  # Required frameworks for iOS audio (Core Audio)
  s.frameworks = [
    'AVFoundation'
  ]

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm}",
    # Miniaudio implementation - compile as Objective-C (generated)
    "libs/generated/miniaudio.m",
    "libs/miniaudio/miniaudio.h",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]
  s.public_header_files = "libs/miniaudio/miniaudio.h"

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'

  load 'nitrogen/generated/ios/AudioAnalyzer+autolinking.rb'
  add_nitrogen_files(s)

  install_modules_dependencies(s)
end
