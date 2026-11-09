import ExpoModulesCore
import Foundation
import AVFoundation
import Speech

private struct LyricsFailure: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

// One explicitly requested analysis at a time; no microphone, no server fallback.
@MainActor private final class LocalLyricsRecognizer {
  static let shared = LocalLyricsRecognizer()
  private var job: String?
  private var cancelled = false
  private var pendingCancellations = Set<String>()
  private var speechTask: SFSpeechRecognitionTask?
  private var exporter: AVAssetExportSession?
  private var finishRecognition: ((Result<[[String: Any]], Error>) -> Void)?
  private var timeout: Task<Void, Never>?

  func cancel(_ id: String) {
    guard job == id else {
      if pendingCancellations.count > 100 { pendingCancellations.removeAll() }
      pendingCancellations.insert(id)
      return
    }
    cancelled = true
    exporter?.cancelExport()
    finishRecognition?(.failure(CancellationError()))
    speechTask?.cancel()
  }

  private func check() throws {
    if cancelled { throw CancellationError() }
  }

  func analyze(_ path: String, locale: String, id: String,
               progress: @escaping (Double) -> Void) async throws -> [[String: Any]] {
    if pendingCancellations.remove(id) != nil { throw CancellationError() }
    guard job == nil else { throw LyricsFailure(message: "Une analyse est déjà en cours.") }
    guard let url = URL(string: path), url.isFileURL,
          url.standardizedFileURL.path.hasPrefix(NSHomeDirectory() + "/") else {
      throw LyricsFailure(message: "Choisis un fichier audio local de Peak Music.")
    }
    job = id; cancelled = false
    defer { timeout?.cancel(); timeout = nil; speechTask?.cancel(); speechTask = nil
      finishRecognition = nil; exporter = nil; job = nil }
    let permission = await withCheckedContinuation { continuation in
      SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
    }
    try check()
    guard permission == .authorized else {
      throw LyricsFailure(message: "Autorise la reconnaissance vocale dans Réglages pour analyser ce fichier local.")
    }
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)),
          recognizer.supportsOnDeviceRecognition, recognizer.isAvailable else {
      throw LyricsFailure(message: "Le modèle local de cette langue n’est pas disponible. Aucun audio n’a été envoyé.")
    }
    let asset = AVURLAsset(url: url)
    let duration = try await asset.load(.duration).seconds
    guard duration.isFinite, duration > 0, duration <= 900 else {
      throw LyricsFailure(message: "Ce mode expérimental accepte les morceaux de 15 minutes maximum.")
    }
    var words: [[String: Any]] = []
    var start = 0.0
    while start < duration {
      try check()
      let length = min(40.0, duration - start)
      let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".m4a")
      defer { try? FileManager.default.removeItem(at: temporary) }
      guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
        throw LyricsFailure(message: "Impossible de préparer l’audio.")
      }
      exporter = session
      session.outputURL = temporary
      session.outputFileType = .m4a
      session.timeRange = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600),
                                      duration: CMTime(seconds: length, preferredTimescale: 600))
      await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
        session.exportAsynchronously { continuation.resume() }
      }
      try check()
      guard session.status == .completed else {
        throw session.error ?? LyricsFailure(message: "Préparation audio interrompue.")
      }
      let request = SFSpeechURLRecognitionRequest(url: temporary)
      request.requiresOnDeviceRecognition = true
      request.shouldReportPartialResults = false
      request.taskHint = .dictation
      let offset = start
      let chunk: [[String: Any]] = try await withCheckedThrowingContinuation { continuation in
        var finished = false
        let complete: (Result<[[String: Any]], Error>) -> Void = { result in
          guard !finished else { return }
          finished = true
          self.timeout?.cancel()
          self.finishRecognition = nil
          continuation.resume(with: result)
        }
        self.finishRecognition = complete
        self.speechTask = recognizer.recognitionTask(with: request) { result, error in
          Task { @MainActor in
            if let result = result, result.isFinal {
              complete(.success(result.bestTranscription.segments.map {
                ["text": $0.substring, "start": offset + $0.timestamp,
                 "end": offset + $0.timestamp + $0.duration, "confidence": $0.confidence]
              }))
            } else if let error = error {
              let failure = error as NSError
              if (failure.domain == "kAFAssistantErrorDomain" && failure.code == 1110) ||
                   failure.localizedDescription.lowercased() == "no speech detected" {
                // Instrumental/silent chunk: keep its absolute offset and continue.
                complete(.success([]))
              } else {
                complete(.failure(error))
              }
            }
          }
        }
        self.timeout = Task { @MainActor in
          do { try await Task.sleep(nanoseconds: 90_000_000_000) } catch { return }
          complete(.failure(LyricsFailure(message: "L’analyse locale a dépassé le délai. Essaie une autre langue.")))
          self.speechTask?.cancel()
        }
      }
      try check()
      words.append(contentsOf: chunk)
      speechTask?.cancel(); speechTask = nil
      start += length
      progress(min(1, start / duration))
    }
    guard !words.isEmpty else {
      throw LyricsFailure(message: "Aucune voix reconnue sur l’ensemble du morceau. Le moteur vocal peut ne pas reconnaître le chant. Essaie les paroles synchronisées en ligne.")
    }
    return words
  }
}

public class PeakLyricsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PeakLyrics")
    Events("onAnalysisProgress")
    AsyncFunction("analyze") { (path: String, locale: String, id: String) async throws -> [[String: Any]] in
      try await LocalLyricsRecognizer.shared.analyze(path, locale: locale, id: id) { fraction in
        self.sendEvent("onAnalysisProgress", ["jobID": id, "fraction": fraction])
      }
    }
    AsyncFunction("cancel") { (id: String) async in
      await LocalLyricsRecognizer.shared.cancel(id)
    }
  }
}
