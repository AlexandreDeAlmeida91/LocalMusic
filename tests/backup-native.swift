import Foundation
@main struct BackupTest {
 static func main() throws {
  let a=PeakBackupArchive.self,fm=FileManager.default,root=a.root
  defer {try? fm.removeItem(at:a.documents)}
  try fm.createDirectory(at:root.appendingPathComponent("Music"),withIntermediateDirectories:true)
  let audio=Data(repeating:42,count:2_100_000)
  try audio.write(to:root.appendingPathComponent("Music/test.m4a"))
  try Data("[{\"id\":\"s\",\"title\":\"Test\",\"audioPath\":\"Music/test.m4a\"}]".utf8).write(to:root.appendingPathComponent("library.json"))
  try Data("[{\"id\":\"p\",\"name\":\"Test\",\"songIds\":[\"s\"]}]".utf8).write(to:root.appendingPathComponent("playlists.json"))
  try Data("{\"songOrder\":\"newest\"}".utf8).write(to:root.appendingPathComponent("preferences.json"))
  // Force a symlink alias, reproducing macOS /var -> /private/var paths.
  let actual=a.documents.appendingPathComponent("ActualLibrary",isDirectory:true)
  try fm.moveItem(at:root,to:actual)
  try fm.createSymbolicLink(at:root,withDestinationURL:actual)
  let archive=try a.export(),url=URL(string:archive)!
  try fm.removeItem(at:root)
  try fm.moveItem(at:actual,to:root)
  let info=try a.inspect(archive)
  precondition(info["songs"] as? Int == 1)
  let stage=info["stage"] as! String
  let restoredDirectory=try a.staged(stage)
  for name in ["library.json","playlists.json","preferences.json","Music/test.m4a"] {
    precondition(fm.fileExists(atPath:restoredDirectory.appendingPathComponent(name).path),"Missing archive entry: \(name)")
  }
  try Data("old".utf8).write(to:root.appendingPathComponent("Music/test.m4a"))
  try a.restore(stage)
  do { let restored=try Data(contentsOf:root.appendingPathComponent("Music/test.m4a"));precondition(restored == audio) }
  precondition(!fm.fileExists(atPath:a.rollback.path))
  // Corruption must fail without touching the current library.
  var bytes=try Data(contentsOf:url);bytes[bytes.count/2] ^= 1
  let broken=a.cache.appendingPathComponent("broken.peakbackup");try bytes.write(to:broken)
  var rejected=false;do{_ = try a.inspect(broken.absoluteString)}catch{rejected=true};precondition(rejected)
  do { let restored=try Data(contentsOf:root.appendingPathComponent("Music/test.m4a"));precondition(restored == audio) }
  // Truncated archives and traversal paths are rejected.
  try bytes.prefix(40).write(to:broken);rejected=false
  do{_ = try a.inspect(broken.absoluteString)}catch{rejected=true};precondition(rejected)
  for path in ["../x","Music/../../x","/x","Music\\x","Music//x","Music/./x"] {precondition(!a.safe(path))}
  // Recover a crash between the two directory moves.
  try fm.moveItem(at:root,to:a.rollback);try a.recover()
  precondition(fm.fileExists(atPath:root.path))
  print("Backup round trip, corruption, truncation, traversal and rollback tests passed")
 }
}
