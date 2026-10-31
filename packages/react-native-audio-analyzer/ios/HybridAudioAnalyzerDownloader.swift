import CryptoKit
import Foundation
import NitroModules

/// Downloads remote audio files into `Caches/react-native-audio-analyzer/`.
///
/// Files are keyed by the SHA-256 of the full URL (query string included) and
/// keep the URL's file extension, which lets miniaudio pick the right decoder
/// without probing. Downloads stream to a temporary file and are moved into
/// place atomically, so an interrupted download never leaves a truncated file
/// in the cache.
final class HybridAudioAnalyzerDownloader: HybridAudioAnalyzerDownloaderSpec {
  private static let cacheFolderName = "react-native-audio-analyzer"

  func load(url: String, headers: [String: String]) throws -> Promise<String> {
    return Promise.async {
      guard let remoteURL = URL(string: url),
            let scheme = remoteURL.scheme?.lowercased(),
            scheme == "http" || scheme == "https"
      else {
        throw DownloaderError.invalidURL(url)
      }

      let fileManager = FileManager.default
      let destination = try Self.cachedFileURL(for: remoteURL)
      if fileManager.fileExists(atPath: destination.path) {
        return destination.path
      }

      var request = URLRequest(url: remoteURL, timeoutInterval: 30)
      for (name, value) in headers {
        request.setValue(value, forHTTPHeaderField: name)
      }
      let policy = RedirectPolicy(origin: remoteURL, headerNames: Array(headers.keys))
      let (temporaryURL, response) = try await URLSession.shared.download(for: request, delegate: policy)
      defer { try? fileManager.removeItem(at: temporaryURL) }

      if let httpResponse = response as? HTTPURLResponse,
         !(200..<300).contains(httpResponse.statusCode) {
        throw DownloaderError.httpStatus(httpResponse.statusCode, url)
      }

      do {
        // clearCache() may have removed the folder during the download.
        try fileManager.createDirectory(
          at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        try fileManager.moveItem(at: temporaryURL, to: destination)
      } catch {
        // A concurrent load() of the same URL may have finished first; its
        // file is just as valid as ours.
        guard fileManager.fileExists(atPath: destination.path) else { throw error }
      }
      return destination.path
    }
  }

  /// Downloads cached by v3 (`<md5>.audio` in the temporary directory); v4 never reads them.
  static func legacyFiles() -> [URL] {
    let directory = FileManager.default.temporaryDirectory
    let files = (try? FileManager.default.contentsOfDirectory(
      at: directory, includingPropertiesForKeys: nil)) ?? []
    return files.filter { file in
      let name = file.lastPathComponent
      return name.count == 38 && name.hasSuffix(".audio")
        && name.prefix(32).allSatisfy { $0.isHexDigit && !$0.isUppercase }
    }
  }

  func clearCache() throws -> Promise<Void> {
    return Promise.async {
      let folder = try Self.cacheFolder()
      let files = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
      for file in files + Self.legacyFiles() {
        do {
          try FileManager.default.removeItem(at: file)
        } catch {
          // Fine if it is already gone (e.g. a concurrent clearCache()).
          if FileManager.default.fileExists(atPath: file.path) { throw error }
        }
      }
    }
  }

  func getCacheSize() throws -> Promise<Double> {
    return Promise.async {
      let folder = try Self.cacheFolder()
      let files = try FileManager.default.contentsOfDirectory(
        at: folder, includingPropertiesForKeys: [.fileSizeKey]) + Self.legacyFiles()
      // A file may be deleted by clearCache() while we iterate; skip it.
      return files.reduce(0.0) { total, file in
        total + Double((try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
      }
    }
  }

  private static func cacheFolder() throws -> URL {
    let cachesDirectory = try FileManager.default.url(
      for: .cachesDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let folder = cachesDirectory.appendingPathComponent(cacheFolderName, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    return folder
  }

  private static func cachedFileURL(for remoteURL: URL) throws -> URL {
    let folder = try cacheFolder()

    let digest = SHA256.hash(data: Data(remoteURL.absoluteString.utf8))
    let name = digest.map { String(format: "%02x", $0) }.joined()
    return folder.appendingPathComponent(name).appendingPathExtension(fileExtension(of: remoteURL))
  }

  private static func fileExtension(of url: URL) -> String {
    let candidate = url.pathExtension.lowercased()
    let isSafe = !candidate.isEmpty && candidate.count <= 5
      && candidate.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) }
    return isSafe ? candidate : "audio"
  }
}

/// Keeps caller-supplied headers (such as `Authorization`) on the origin the
/// caller asked for: when a redirect leads to another scheme, host or port,
/// they are removed from the redirected request, like browsers do with
/// credentials.
final class RedirectPolicy: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
  // Immutable after init, hence safe to share across threads.
  private let origin: URL
  private let headerNames: [String]

  init(origin: URL, headerNames: [String]) {
    self.origin = origin
    self.headerNames = headerNames
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    guard let target = request.url, !Self.sameOrigin(origin, target) else {
      completionHandler(request)
      return
    }
    var stripped = request
    for name in headerNames {
      stripped.setValue(nil, forHTTPHeaderField: name)
    }
    completionHandler(stripped)
  }

  static func sameOrigin(_ a: URL, _ b: URL) -> Bool {
    return a.scheme?.lowercased() == b.scheme?.lowercased()
      && a.host?.lowercased() == b.host?.lowercased()
      && effectivePort(a) == effectivePort(b)
  }

  private static func effectivePort(_ url: URL) -> Int? {
    if let port = url.port { return port }
    switch url.scheme?.lowercased() {
    case "https": return 443
    case "http": return 80
    default: return nil
    }
  }
}

enum DownloaderError: LocalizedError {
  case invalidURL(String)
  case httpStatus(Int, String)

  var errorDescription: String? {
    switch self {
    case let .invalidURL(url):
      return "load() expects an http:// or https:// URL, got \"\(url)\"."
    case let .httpStatus(status, url):
      return "Failed to download \"\(url)\": server responded with HTTP \(status)."
    }
  }
}
