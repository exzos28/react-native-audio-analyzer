// The single translation unit that compiles miniaudio and stb_vorbis.
#define MINIAUDIO_IMPLEMENTATION
#include "MiniaudioConfig.h"

// stb_vorbis' implementation must come after miniaudio's.
#undef STB_VORBIS_HEADER_ONLY
#include "../libs/miniaudio/extras/stb_vorbis.c"
