package com.margelo.nitro.audioanalyzer

import java.net.URL

/**
 * Which caller-supplied headers each hop of a redirect chain may carry.
 * Headers (such as `Authorization`) are only sent to the origin the caller
 * asked for. Once a redirect leaves that origin they are dropped for good,
 * even if a later redirect comes back: otherwise any third-party host could
 * bounce the request to a path of its choosing on the original origin and
 * have the credentials sent there. This matches iOS, where URLSession builds
 * each redirected request from the previous one.
 */
internal class RedirectPolicy(private val origin: URL, private val headers: Map<String, String>) {
  private var leftOrigin = false

  /** Headers for the request to `current`; call once per hop, in order. */
  fun headersFor(current: URL): Map<String, String> {
    if (!sameOrigin(origin, current)) leftOrigin = true
    return if (leftOrigin) emptyMap() else headers
  }

  companion object {

    fun sameOrigin(a: URL, b: URL): Boolean =
      a.protocol.equals(b.protocol, ignoreCase = true) &&
        a.host.equals(b.host, ignoreCase = true) &&
        effectivePort(a) == effectivePort(b)

    private fun effectivePort(url: URL): Int = if (url.port != -1) url.port else url.defaultPort
  }
}
