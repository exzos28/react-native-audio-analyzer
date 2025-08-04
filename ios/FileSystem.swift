import Foundation
import CryptoKit
import NitroModules

class FileSystem: HybridFileSystemSpec {
  func load(path: String) -> Promise<String> {
    return Promise.async {
        guard let url = URL(string: path) else {
            throw NSError(domain: "FileSystem", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }

        // HEAD request to get file size
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"
        let (_, response) = try await URLSession.shared.data(for: request)

        var fileSize: Int64 = 0
        if let httpResponse = response as? HTTPURLResponse,
           let lengthString = httpResponse.value(forHTTPHeaderField: "Content-Length"),
           let length = Int64(lengthString) {
            fileSize = length
        }

        // Compute hash based on file name and size
        let fileName = url.lastPathComponent
        let key = "\(fileName)-\(fileSize)"
        let hash = Insecure.MD5.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()

        // Cache file path
        let cacheDir = FileManager.default.temporaryDirectory
        let fileURL = cacheDir.appendingPathComponent("\(hash).audio")

        if !FileManager.default.fileExists(atPath: fileURL.path) {
            let (data, _) = try await URLSession.shared.data(from: url)
            try data.write(to: fileURL)
        }

        return fileURL.path
    }
  }
}
