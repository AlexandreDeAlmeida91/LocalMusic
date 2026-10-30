import ExpoModulesCore
import Foundation
import AVFoundation

private struct ImportFailure: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

private struct MediaHTTPFailure: LocalizedError {
  let status: Int
  var errorDescription: String? { "Téléchargement refusé par le service (HTTP \(status))." }
}

private actor ImportJobs {
  var tasks: [String: Task<[String: String], Error>] = [:]
  var cancelled = Set<String>()
  func run(_ id: String, work: @escaping () async throws -> [String: String]) async throws -> [String: String] {
    if cancelled.remove(id) != nil { throw CancellationError() }
    guard tasks.isEmpty else { throw ImportFailure(message: "Un import est déjà en cours.") }
    let task = Task { try await work() }
    tasks[id] = task
    defer { tasks.removeValue(forKey: id) }
    return try await task.value
  }
  func cancel(_ id: String) {
    if let task = tasks[id] { task.cancel() }
    else {
      if cancelled.count > 100 { cancelled.removeAll() }
      cancelled.insert(id)
    }
  }
}

public class PeakImportModule: Module {
  private let jobs = ImportJobs()

  public func definition() -> ModuleDefinition {
    Name("PeakImport")
    Events("onProgress")

    AsyncFunction("youtube") { (videoID: String, jobID: String) async throws -> [String: String] in
      try await self.jobs.run(jobID) {
        guard videoID.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil else {
          throw ImportFailure(message: "Identifiant YouTube incorrect.")
        }
        self.progress(jobID, "Recherche du flux audio…")
        // Explicit local-only extraction: never opt into YouTubeKit's remote fallback.
        for round in 0..<2 {
          try Task.checkCancellation()
          let video = YouTube(videoID: videoID, methods: [.local])
          let streams = try await video.streams
          let candidates = streams.filterAudioOnly()
            .filter({ $0.fileExtension == .m4a && $0.isNativelyPlayable })
            .sorted { ($0.averageBitrate ?? $0.bitrate ?? 0) > ($1.averageBitrate ?? $1.bitrate ?? 0) }
          guard !candidates.isEmpty else {
            throw ImportFailure(message: "YouTube ne fournit pas de flux audio M4A compatible pour ce lien.")
          }
          let metadata = try? await video.metadata
          // Some YouTube responses require a preroll delay BEFORE first CDN access.
          // A refusal is not proof of that cause: also retain alternate client URLs.
          self.progress(jobID, round == 0 ? "Préparation du téléchargement YouTube…" : "Actualisation des adresses audio YouTube…")
          try await Task.sleep(nanoseconds: 6_000_000_000)
          for (index, stream) in candidates.prefix(6).enumerated() {
            try Task.checkCancellation()
            if index > 0 { self.progress(jobID, "Essai d’une autre source audio YouTube…") }
            do {
              var result = try await self.download(stream.url, mode: "direct", ext: "m4a", jobID: jobID, headers: stream.downloadHeaders)
              result["title"] = metadata?.title ?? "YouTube \(videoID)"
              return result
            } catch let error as MediaHTTPFailure where [403, 410].contains(error.status) {
              // Try a distinct URL, then re-extract once. Never loop indefinitely
              // or hide a persistent refusal behind a successful import status.
              continue
            }
          }
        }
        throw ImportFailure(message: "YouTube refuse toujours l’accès au fichier audio (403/410), même après actualisation et essai des autres sources. Aucun morceau n’a été ajouté. Le blocage peut venir du lien, du réseau ou du moteur d’extraction.")
      }
    }

    AsyncFunction("media") { (rawURL: String, mode: String, jobID: String) async throws -> [String: String] in
      try await self.jobs.run(jobID) {
        guard let url = URL(string: rawURL), Self.allowed(url) else {
          throw ImportFailure(message: "Adresse du flux audio refusée.")
        }
        guard ["direct", "hls-mp3", "hls-aac"].contains(mode) else {
          throw ImportFailure(message: "Format SoundCloud non pris en charge.")
        }
        return try await self.download(url, mode: mode, ext: mode == "hls-aac" ? "m4a" : "mp3", jobID: jobID)
      }
    }

    AsyncFunction("cancel") { (jobID: String) async in await self.jobs.cancel(jobID) }
  }

  private func progress(_ id: String, _ phase: String, fraction: Double? = nil) {
    var event: [String: Any] = ["jobID": id, "phase": phase]
    if let fraction { event["fraction"] = fraction }
    sendEvent("onProgress", event)
  }

  fileprivate static func allowed(_ url: URL) -> Bool {
    guard url.scheme == "https", url.user == nil, url.password == nil,
          url.port == nil || url.port == 443, let host = url.host?.lowercased() else { return false }
    return ["googlevideo.com", "youtube.com", "sndcdn.com", "soundcloud.com"].contains {
      host == $0 || host.hasSuffix("." + $0)
    }
  }

  private func download(_ url: URL, mode: String, ext: String, jobID: String, headers: [String: String] = [:]) async throws -> [String: String] {
    guard Self.allowed(url) else { throw ImportFailure(message: "Domaine audio non reconnu.") }
    let fm = FileManager.default
    let root = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("PeakImports", isDirectory: true)
    try fm.createDirectory(at: root, withIntermediateDirectories: true)
    // Only one native import at a time. Clean remnants of interrupted old imports.
    for file in (try? fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? [] {
      try? fm.removeItem(at: file)
    }
    let output = root.appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
    var success = false
    defer { if !success { try? fm.removeItem(at: output) } }
    let delegate = MediaRedirectGuard()
    let config = URLSessionConfiguration.ephemeral
    config.httpAdditionalHeaders = headers
    config.httpCookieStorage = HTTPCookieStorage.shared
    config.timeoutIntervalForRequest = 30
    config.timeoutIntervalForResource = 600
    let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    defer { session.invalidateAndCancel() }
    try Task.checkCancellation()
    self.progress(jobID, "Téléchargement sur l’iPhone…")

    if mode.hasPrefix("hls-") {
      let (manifestData, response) = try await session.data(from: url)
      try Self.check(response)
      guard manifestData.count < 2_000_000, let manifest = String(data: manifestData, encoding: .utf8) else {
        throw ImportFailure(message: "Playlist audio illisible.")
      }
      let segments = try Self.audioSegments(manifest, base: response.url ?? url, fragmented: mode == "hls-aac")
      fm.createFile(atPath: output.path, contents: nil)
      let writer = try FileHandle(forWritingTo: output)
      defer { try? writer.close() }
      var total = 0
      for (index, segment) in segments.enumerated() {
        try Task.checkCancellation()
        let (data, segmentResponse) = try await session.data(from: segment)
        try Self.check(segmentResponse)
        let payload: Data
        if mode == "hls-aac" {
          // AAC HLS from SoundCloud is fragmented MP4: init (ftyp/moov), then
          // moof/mdat fragments. Preserve the original AAC bytes without re-encoding.
          let boxType = data.count >= 8 ? String(data: data.subdata(in: 4..<8), encoding: .ascii) : nil
          guard let boxType, (index == 0 ? ["ftyp"] : ["styp", "moof", "sidx", "emsg"]).contains(boxType) else {
            throw ImportFailure(message: "Ce flux AAC n’utilise pas des fragments M4A compatibles.")
          }
          payload = data
        } else {
          payload = try Self.mp3Payload(data)
        }
        total += payload.count
        guard total <= 512 * 1024 * 1024 else { throw ImportFailure(message: "Le fichier dépasse 512 Mo.") }
        try writer.write(contentsOf: payload)
        self.progress(jobID, "Téléchargement sur l’iPhone…", fraction: Double(index + 1) / Double(segments.count))
      }
      try writer.synchronize()
    } else {
      let (temporary, response) = try await session.download(from: url)
      defer { try? fm.removeItem(at: temporary) }
      try Self.check(response)
      let size = (try fm.attributesOfItem(atPath: temporary.path)[.size] as? NSNumber)?.intValue ?? 0
      guard size > 1024, size <= 512 * 1024 * 1024 else {
        throw ImportFailure(message: "Fichier audio vide ou supérieur à 512 Mo.")
      }
      try fm.moveItem(at: temporary, to: output)
    }

    try Task.checkCancellation()
    self.progress(jobID, "Vérification du morceau…")
    let asset = AVURLAsset(url: output, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
    let audio = try await asset.loadTracks(withMediaType: .audio)
    let duration = try await asset.load(.duration).seconds
    guard !audio.isEmpty, duration.isFinite, duration > 1 else {
      throw ImportFailure(message: "Le téléchargement ne contient pas de morceau audio lisible.")
    }
    try Task.checkCancellation()
    success = true
    return ["uri": output.absoluteString, "extension": ext, "duration": String(duration)]
  }

  fileprivate static func check(_ response: URLResponse) throws {
    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
      throw MediaHTTPFailure(status: (response as? HTTPURLResponse)?.statusCode ?? 0)
    }
  }

  static func audioSegments(_ text: String, base: URL, fragmented: Bool) throws -> [URL] {
    let lines = text.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
    guard lines.first == "#EXTM3U", lines.contains("#EXT-X-ENDLIST"),
          !lines.contains(where: { ($0.hasPrefix("#EXT-X-KEY") && $0 != "#EXT-X-KEY:METHOD=NONE") || $0.hasPrefix("#EXT-X-BYTERANGE") || $0.hasPrefix("#EXT-X-STREAM-INF") || $0.hasPrefix("#EXT-X-DISCONTINUITY") }) else {
      throw ImportFailure(message: "Ce flux SoundCloud est protégé ou utilise un format non pris en charge.")
    }
    var paths = lines.filter { !$0.isEmpty && !$0.hasPrefix("#") }
    let maps = lines.filter { $0.hasPrefix("#EXT-X-MAP:") }
    if fragmented {
      guard maps.count == 1, !maps[0].contains("BYTERANGE"),
            let range = maps[0].range(of: "URI=\"[^\"]+\"", options: .regularExpression) else {
        throw ImportFailure(message: "Le flux AAC ne fournit pas d’en-tête M4A compatible.")
      }
      let value = String(maps[0][range]).dropFirst(5).dropLast()
      paths.insert(String(value), at: 0)
    } else if !maps.isEmpty {
      throw ImportFailure(message: "En-tête inattendu dans le flux MP3.")
    }
    guard !paths.isEmpty, paths.count <= 2000 else { throw ImportFailure(message: "Playlist audio vide ou trop longue.") }
    return try paths.map {
      guard let segment = URL(string: $0, relativeTo: base)?.absoluteURL, allowed(segment) else {
        throw ImportFailure(message: "Adresse de segment audio non reconnue.")
      }
      return segment
    }
  }

  static func mp3Payload(_ data: Data) throws -> Data {
    let bytes = [UInt8](data.prefix(10))
    var offset = 0
    if bytes.count >= 10 && Array(bytes.prefix(3)) == [73, 68, 51] {
      offset = 10 + (Int(bytes[6] & 127) << 21) + (Int(bytes[7] & 127) << 14) + (Int(bytes[8] & 127) << 7) + Int(bytes[9] & 127)
      if bytes[3] == 4 && bytes[5] & 16 != 0 { offset += 10 }
    }
    guard offset + 2 < data.count, data[offset] == 255,
          data[offset + 1] & 224 == 224, data[offset + 1] & 6 != 0 else {
      throw ImportFailure(message: "Le segment reçu n’est pas un MP3 compatible.")
    }
    return data.subdata(in: offset..<data.count)
  }
}

private final class MediaRedirectGuard: NSObject, URLSessionTaskDelegate {
  func urlSession(_ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(request.url.map(PeakImportModule.allowed) == true ? request : nil)
  }
}
