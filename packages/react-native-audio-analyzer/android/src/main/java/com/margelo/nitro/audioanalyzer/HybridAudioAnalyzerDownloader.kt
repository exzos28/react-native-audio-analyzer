package com.margelo.nitro.audioanalyzer

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.URL
import java.security.MessageDigest

/**
 * Downloads remote audio files into `cacheDir/react-native-audio-analyzer/`
 * (in-progress downloads live in `cacheDir/react-native-audio-analyzer-partial/`).
 *
 * Files are keyed by the SHA-256 of the full URL (query string included) and
 * keep the URL's file extension, which lets miniaudio pick the right decoder
 * without probing. Downloads stream to a temporary file that is renamed into
 * place only after the body was fully received, so an interrupted download
 * never leaves a truncated file in the cache.
 */
@DoNotStrip
class HybridAudioAnalyzerDownloader : HybridAudioAnalyzerDownloaderSpec() {
  override fun load(url: String, headers: Map<String, String>): Promise<String> {
    return Promise.parallel { download(url, headers) }
  }

  override fun clearCache(): Promise<Unit> {
    return Promise.parallel {
      // Only completed files: downloads in progress live in a separate folder
      // and are not affected.
      ((cacheFolder().listFiles() ?: emptyArray()) + legacyFiles()).forEach { file ->
        if (!file.delete() && file.exists()) {
          throw IOException("Failed to delete ${file.absolutePath}")
        }
      }
      Unit
    }
  }

  override fun getCacheSize(): Promise<Double> {
    return Promise.parallel {
      ((cacheFolder().listFiles() ?: emptyArray()) + legacyFiles()).sumOf { it.length() }.toDouble()
    }
  }

  private fun folder(name: String): File {
    val context = NitroModules.applicationContext
      ?: throw IllegalStateException("react-native-audio-analyzer: React context is not available yet.")
    val folder = File(context.cacheDir, name)
    if (!folder.isDirectory && !folder.mkdirs()) {
      throw IOException("Failed to create cache folder ${folder.absolutePath}")
    }
    return folder
  }

  /** Completed downloads. */
  private fun cacheFolder(): File = folder(CACHE_FOLDER_NAME)

  /** Downloads cached by v3 (`<md5>.audio` directly in cacheDir); v4 never reads them. */
  private fun legacyFiles(): Array<File> {
    val cacheDir = NitroModules.applicationContext?.cacheDir ?: return emptyArray()
    return cacheDir.listFiles { file -> file.isFile && LEGACY_FILE.matches(file.name) } ?: emptyArray()
  }

  /**
   * Downloads in progress; on the same filesystem as the cache so they can be
   * renamed into it. Files left behind by a previous process (killed during a
   * download) are deleted on first use. The lock makes concurrent first calls
   * wait for that cleanup, so it never touches a download of this process.
   */
  private fun partialFolder(): File {
    val folder = folder(PARTIAL_FOLDER_NAME)
    synchronized(partialLock) {
      if (!partialFolderCleaned) {
        folder.listFiles()?.forEach { it.delete() }
        partialFolderCleaned = true
      }
    }
    return folder
  }

  private fun download(url: String, headers: Map<String, String>): String {
    val remoteUrl = parseHttpUrl(url, url)
    val target = File(cacheFolder(), "${sha256(url)}.${fileExtension(remoteUrl)}")
    if (target.exists()) {
      return target.absolutePath
    }

    val connection = open(remoteUrl, headers, url)
    try {
      val partial = File.createTempFile("download-", ".part", partialFolder())
      try {
        connection.inputStream.use { input ->
          partial.outputStream().use { output -> input.copyTo(output) }
        }
        // clearCache() may have removed the cache folder in the meantime.
        cacheFolder()
        // A concurrent load() of the same URL may have finished first; its
        // file is just as valid as ours.
        if (!partial.renameTo(target) && !target.exists()) {
          throw IOException("Failed to move the downloaded file to ${target.absolutePath}")
        }
      } finally {
        partial.delete()
      }
    } finally {
      connection.disconnect()
    }

    return target.absolutePath
  }

  /**
   * Opens a connection and follows redirects manually: HttpURLConnection does
   * not follow redirects between http and https, which are common on CDNs.
   */
  private fun open(start: URL, headers: Map<String, String>, original: String): HttpURLConnection {
    var current = start
    val policy = RedirectPolicy(start, headers)
    repeat(MAX_REDIRECTS + 1) {
      val connection = current.openConnection() as HttpURLConnection
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS
      connection.instanceFollowRedirects = false
      policy.headersFor(current).forEach { (name, value) ->
        connection.setRequestProperty(name, value)
      }

      val status = connection.responseCode
      if (status in 300..399) {
        val location = connection.getHeaderField("Location")
        connection.disconnect()
        if (location == null) {
          throw IOException("Failed to download \"$original\": HTTP $status without a Location header.")
        }
        current = parseHttpUrl(URL(current, location).toString(), original)
        return@repeat
      }
      if (status !in 200..299) {
        connection.disconnect()
        throw IOException("Failed to download \"$original\": server responded with HTTP $status.")
      }
      return connection
    }
    throw IOException("Failed to download \"$original\": more than $MAX_REDIRECTS redirects.")
  }

  private companion object {
    private val partialLock = Any()
    @Volatile private var partialFolderCleaned = false

    const val CACHE_FOLDER_NAME = "react-native-audio-analyzer"
    const val PARTIAL_FOLDER_NAME = "react-native-audio-analyzer-partial"
    const val TIMEOUT_MS = 30_000
    const val MAX_REDIRECTS = 5
    val SAFE_EXTENSION = Regex("^[a-z0-9]{1,5}$")
    val LEGACY_FILE = Regex("^[0-9a-f]{32}\\.audio$")

    fun parseHttpUrl(value: String, original: String): URL {
      val url = try {
        URL(value)
      } catch (e: MalformedURLException) {
        throw IllegalArgumentException(invalidUrlMessage(original), e)
      }
      if (url.protocol != "http" && url.protocol != "https") {
        throw IllegalArgumentException(invalidUrlMessage(original))
      }
      return url
    }

    fun invalidUrlMessage(url: String) = "load() expects an http:// or https:// URL, got \"$url\"."

    fun sha256(value: String): String =
      MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }

    fun fileExtension(url: URL): String {
      val candidate = url.path.substringAfterLast('/').substringAfterLast('.', "").lowercase()
      return if (SAFE_EXTENSION.matches(candidate)) candidate else "audio"
    }
  }
}
