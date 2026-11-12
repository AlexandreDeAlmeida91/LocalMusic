import UIKit
import BackgroundTasks
import ExpoModulesCore

@MainActor
final class PeakBackgroundRuntime {
  static let shared = PeakBackgroundRuntime()
  static let identifier = "com.alexandre.localmusic.playlist-import"
  private var task: BGTask?
  private var registered = false
  private var requested = false
  private var total: Int64 = 1
  private var completed: Int64 = 0
  var notify: ((String) -> Void)?

  func register() {
    guard !registered else { return }
    if #available(iOS 26.0, *) {
      registered = BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.identifier, using: .main) { task in
        Task { @MainActor in
          guard self.requested, let continued = task as? BGContinuedProcessingTask else {
            task.setTaskCompleted(success: false); return
          }
          self.task = continued
          continued.progress.totalUnitCount = self.total
          continued.progress.completedUnitCount = self.completed
          continued.expirationHandler = {
            Task { @MainActor in
              self.notify?("expired")
              self.finish(success: false)
            }
          }
          self.notify?("active")
        }
      }
    }
  }
  func begin() -> String {
    finish(success: false)
    register()
    total = 1; completed = 0
    if #available(iOS 26.0, *), registered {
      let request = BGContinuedProcessingTaskRequest(identifier: Self.identifier,
        title: "Import Peak Music", subtitle: "Préparation de la playlist")
      request.strategy = .fail
      do { requested = true; try BGTaskScheduler.shared.submit(request); return "requested" }
      catch { requested = false; return "transfers" }
    }
    return "transfers"
  }
  func update(done: Int, count: Int) {
    total = Int64(max(1, count)); completed = Int64(min(max(0, done), max(1, count)))
    if #available(iOS 26.0, *), let continued = task as? BGContinuedProcessingTask {
      continued.progress.totalUnitCount = total
      continued.progress.completedUnitCount = completed
      continued.updateTitle("Import Peak Music", subtitle: "\(done) / \(count) morceaux traités")
    }
  }
  func finish(success: Bool) {
    task?.setTaskCompleted(success: success); task = nil
    if requested { BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.identifier) }
    requested = false
  }
}

public class PeakImportAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    Task { @MainActor in PeakBackgroundRuntime.shared.register() }
    return true
  }
  public func application(_ application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: @escaping () -> Void) {
    if identifier == BackgroundAudioTransfer.identifier {
      BackgroundAudioTransfer.shared.reconnect(completion: completionHandler)
    } else { completionHandler() }
  }
}
