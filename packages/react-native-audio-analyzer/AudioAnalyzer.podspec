require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "AudioAnalyzer"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/exzos28/react-native-audio-analyzer.git", :tag => "react-native-audio-analyzer@#{s.version}" }

  s.source_files = [
    # Hybrid object implementations (Swift)
    "ios/**/*.{swift}",
    # Shared C++ core, Nitro bindings and the miniaudio implementation unit
    "cpp/**/*.{hpp,cpp,c}",
  ]
  s.exclude_files = "cpp/tests/**/*"

  # Debug configurations compile pods at -O0, which makes MP3/FLAC decoding
  # several times slower. Always optimize this pod's C/C++ (Swift is unaffected).
  s.pod_target_xcconfig = {
    "GCC_OPTIMIZATION_LEVEL" => "2",
  }

  # Included by relative path from cpp/, never exposed as public headers.
  s.preserve_paths = [
    "cpp/**/*.h",
    "libs/miniaudio/miniaudio.h",
    "libs/miniaudio/extras/stb_vorbis.c",
  ]

  # Platform decoder (ExtAudioFile) for AAC/M4A, ALAC, AIFF, CAF, …
  s.frameworks = "AudioToolbox"

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'

  load 'nitrogen/generated/ios/AudioAnalyzer+autolinking.rb'
  add_nitrogen_files(s)

  install_modules_dependencies(s)
end
