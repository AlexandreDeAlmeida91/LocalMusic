import Foundation
import CryptoKit

// The delegate owns received files before returning to URLSession. JS is not
// required to be running when a transfer completes on the locked phone.
final class BackgroundAudioTransfer: NSObject, URLSessionDownloadDelegate {
  static let shared = BackgroundAudioTransfer()
  static let identifier = "com.alexandre.localmusic.audio-downloads"
  private let queue = DispatchQueue(label: "PeakMusic.background-transfers")
  private var waiters: [String: CheckedContinuation<(URL, URLResponse), Error>] = [:]
  private var tasks: [String: URLSessionDownloadTask] = [:]
  private var cancelled = Set<String>()
  private var completion: (() -> Void)?
  private lazy var root: URL = {
    let url = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("PeakBackgroundImports", isDirectory: true)
    try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }()
  private lazy var session: URLSession = {
    let config = URLSessionConfiguration.background(withIdentifier: Self.identifier)
    config.isDiscretionary = false
    config.sessionSendsLaunchEvents = true
    config.timeoutIntervalForResource = 3600
    config.httpMaximumConnectionsPerHost = 2
    let delegates = OperationQueue()
    delegates.maxConcurrentOperationCount = 1
    delegates.underlyingQueue = queue
    return URLSession(configuration: config, delegate: self, delegateQueue: delegates)
  }()
  private func file(_ id: String) -> URL {
    let name = SHA256.hash(data: Data(id.utf8)).map { String(format: "%02x", $0) }.joined()
    return root.appendingPathComponent(name + ".audio")
  }
  func reconnect(completion: @escaping () -> Void) {
    queue.async { self.completion = completion; _ = self.session }
  }
  func clearCompleted() async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      queue.async {
        self.session.getAllTasks { tasks in
          self.queue.async {
            guard tasks.isEmpty, self.waiters.isEmpty else {
              continuation.resume(throwing: NSError(domain: "PeakMusic", code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Un téléchargement iOS est encore en cours. Reprends ou termine l’import avant le nettoyage."])); return
            }
            do {
              for file in (try? FileManager.default.contentsOfDirectory(at: self.root, includingPropertiesForKeys: nil)) ?? [] {
                try FileManager.default.removeItem(at: file)
              }
              continuation.resume()
            } catch { continuation.resume(throwing: error) }
          }
        }
      }
    }
  }
  func transfer(_ request: URLRequest, jobID: String) async throws -> (URL, URLResponse) {
    try await withTaskCancellationHandler(operation: {
      try await withCheckedThrowingContinuation { continuation in
        queue.async {
          if self.cancelled.remove(jobID) != nil {
            continuation.resume(throwing: CancellationError()); return
          }
          let saved = self.file(jobID)
          if FileManager.default.fileExists(atPath: saved.path) {
            continuation.resume(returning: (saved, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)); return
          }
          guard self.waiters[jobID] == nil else {
            continuation.resume(throwing: NSError(domain: "PeakMusic", code: 1, userInfo: [NSLocalizedDescriptionKey: "Ce transfert est déjà en cours."])); return
          }
          self.waiters[jobID] = continuation
          self.session.getAllTasks { existing in
            self.queue.async {
              guard self.waiters[jobID] != nil else { return }
              // A restored task may have completed while getAllTasks was running.
              let received = self.file(jobID)
              if FileManager.default.fileExists(atPath: received.path) {
                self.waiters.removeValue(forKey: jobID)?.resume(returning: (received,
                  HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!))
                return
              }
              let task = existing.first(where: { $0.taskDescription == jobID }) as? URLSessionDownloadTask
                ?? self.session.downloadTask(with: request)
              task.taskDescription = jobID
              self.tasks[jobID] = task
              task.resume()
            }
          }
        }
      }
    }, onCancel: { self.cancel(jobID) })
  }
  private func cancel(_ jobID: String) {
    queue.async {
      if self.cancelled.count > 100 { self.cancelled.removeAll() }
      if let waiter = self.waiters.removeValue(forKey: jobID) {
        waiter.resume(throwing: CancellationError())
      } else { self.cancelled.insert(jobID) }
      self.tasks.removeValue(forKey: jobID)?.cancel()
      self.session.getAllTasks { tasks in tasks.filter { $0.taskDescription == jobID }.forEach { $0.cancel() } }
    }
  }
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    guard let id = downloadTask.taskDescription else { return }
    let matching = tasks[id]?.taskIdentifier == downloadTask.taskIdentifier
    do {
      guard let response = downloadTask.response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
      // Background sessions follow redirects themselves; validate the final host.
      guard let url = response.url, PeakImportModule.allowed(url) else { throw URLError(.unsupportedURL) }
      guard (200...299).contains(response.statusCode) else {
        if matching { waiters.removeValue(forKey: id)?.resume(returning: (location, response)) }
        return
      }
      let size = (try FileManager.default.attributesOfItem(atPath: location.path)[.size] as? NSNumber)?.intValue ?? 0
      guard size > 1024 && size <= 512 * 1024 * 1024 else { throw URLError(.dataLengthExceedsMaximum) }
      let destination = file(id)
      try? FileManager.default.removeItem(at: destination)
      try FileManager.default.moveItem(at: location, to: destination)
      if matching { waiters.removeValue(forKey: id)?.resume(returning: (destination, response)) }
    } catch { if matching { waiters.removeValue(forKey: id)?.resume(throwing: error) } }
  }
  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    guard let id = task.taskDescription else { return }
    guard tasks[id]?.taskIdentifier == task.taskIdentifier else { return }
    if let error { waiters.removeValue(forKey: id)?.resume(throwing: error) }
    tasks.removeValue(forKey: id)
  }
  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
    didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
    if totalBytesWritten > 512 * 1024 * 1024 || totalBytesExpectedToWrite > 512 * 1024 * 1024 {
      downloadTask.cancel()
    }
  }
  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    let handler = completion; completion = nil
    DispatchQueue.main.async { handler?() }
  }
}
