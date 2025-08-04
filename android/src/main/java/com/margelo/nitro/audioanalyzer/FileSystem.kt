package com.margelo.nitro.audioanalyzer

import android.content.Context
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import java.io.File
import java.net.URL
import java.security.MessageDigest
import com.margelo.nitro.core.Promise
import com.margelo.nitro.NitroModules

@DoNotStrip
class FileSystem(reactContext: ReactApplicationContext) :
  HybridFileSystemSpec() {

  private val appContext = reactContext.applicationContext

  override fun load(path: String): Promise<String> {
    return Promise.parallel {
      try {
        val url = URL(path)
        val connection = url.openConnection()
        val fileName = path.substringAfterLast('/')
        val fileSize = connection.contentLength
        val key = "$fileName-$fileSize"

        val digest = MessageDigest.getInstance("MD5")
        val hash = digest.digest(key.toByteArray())
          .joinToString("") { "%02x".format(it) }

        val file = File(NitroModules.applicationContext!!.cacheDir, "$hash.audio")

        if (!file.exists()) {
          url.openStream().use { input ->
            file.outputStream().use { output -> input.copyTo(output) }
          }
        }

        file.absolutePath
      } catch (e: Exception) {
        throw RuntimeException("Failed to load and cache file", e)
      }
    }
  }
}
