import Foundation

enum PeakImportResources {
  static let bundle: Bundle = {
    let parent = Bundle(for: PeakImportModule.self)
    guard let url = parent.url(forResource: "PeakImportResources", withExtension: "bundle"),
          let bundle = Bundle(url: url) else { return parent }
    return bundle
  }()
}
