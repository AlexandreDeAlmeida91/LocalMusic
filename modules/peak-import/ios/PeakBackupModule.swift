import ExpoModulesCore
import Foundation
import UIKit

public class PeakBackupModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PeakBackup")
    AsyncFunction("exportBackup") { () throws -> String in try PeakBackupArchive.export() }
    AsyncFunction("inspectBackup") { (uri:String) throws -> [String:Any] in try PeakBackupArchive.inspect(uri) }
    AsyncFunction("restoreBackup") { (token:String) throws in try PeakBackupArchive.restore(token) }
    AsyncFunction("recoverRestore") { () throws in
      try PeakBackupArchive.recover()
      // Interrupted previews/exports are temporary; never keep duplicate audio in cache.
      if FileManager.default.fileExists(atPath:PeakBackupArchive.cache.path) {try FileManager.default.removeItem(at:PeakBackupArchive.cache)}
    }
    AsyncFunction("discardStage") { (token:String) throws in let url=try PeakBackupArchive.staged(token);if FileManager.default.fileExists(atPath:url.path){try FileManager.default.removeItem(at:url)} }
    AsyncFunction("shareBackup") { (uri:String,promise:Promise) in
      guard let url=URL(string:uri),url.isFileURL,url.deletingLastPathComponent().standardizedFileURL==PeakBackupArchive.cache.standardizedFileURL else {promise.reject("BACKUP","Fichier de sauvegarde invalide.");return}
      DispatchQueue.main.async {
        guard let scene=UIApplication.shared.connectedScenes.first(where:{$0.activationState == .foregroundActive}) as? UIWindowScene,
              var presenter=scene.windows.first(where:{$0.isKeyWindow})?.rootViewController else {promise.reject("BACKUP","Écran de partage indisponible.");return}
        while let next=presenter.presentedViewController {presenter=next}
        let sheet=UIActivityViewController(activityItems:[url],applicationActivities:nil)
        sheet.popoverPresentationController?.sourceView=presenter.view
        sheet.popoverPresentationController?.sourceRect=CGRect(x:presenter.view.bounds.midX,y:presenter.view.bounds.midY,width:1,height:1)
        sheet.completionWithItemsHandler={_,completed,_,error in
          if let error {promise.reject(error)} else {promise.resolve(completed)}
        }
        presenter.present(sheet,animated:true)
      }
    }
  }
}
