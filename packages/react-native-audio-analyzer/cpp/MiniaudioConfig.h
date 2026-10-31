// miniaudio build configuration shared by every translation unit that
// includes miniaudio.h. Only the decoding API is needed, so playback, capture
// and everything built on top of it is compiled out: this keeps the binary
// small and removes the dependency on platform audio frameworks
// (AVFoundation/CoreAudio, AAudio/OpenSL ES).
//
// Deliberately a `.h` file: the podspec only exposes `*.hpp` headers, so this
// file never ends up in the iOS module's public headers.
#pragma once

#define MA_NO_DEVICE_IO
#define MA_NO_THREADING
#define MA_NO_ENCODING
#define MA_NO_GENERATION
#define MA_NO_RESOURCE_MANAGER
#define MA_NO_NODE_GRAPH
#define MA_NO_ENGINE

// OGG Vorbis support: miniaudio enables its Vorbis backend when the
// stb_vorbis header is visible (the implementation is compiled in
// MiniaudioImplementation.c).
#ifndef STB_VORBIS_HEADER_ONLY
#define STB_VORBIS_HEADER_ONLY
#define AUDIOANALYZER_UNDEF_STB_VORBIS_HEADER_ONLY
#endif
#include "../libs/miniaudio/extras/stb_vorbis.c"
#ifdef AUDIOANALYZER_UNDEF_STB_VORBIS_HEADER_ONLY
#undef STB_VORBIS_HEADER_ONLY
#undef AUDIOANALYZER_UNDEF_STB_VORBIS_HEADER_ONLY
#endif

#include "../libs/miniaudio/miniaudio.h"
