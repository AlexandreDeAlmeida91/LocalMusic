import Foundation
import CryptoKit

struct BackupFailure: LocalizedError {
  let message: String
  var errorDescription: String? { message }
}

// Streaming archive: bounded JSON header, exact bytes, SHA-256 per file.
// No base64 audio in JS memory, no archive paths outside LocalMusic.
enum PeakBackupArchive {
  static let fm = FileManager.default
  #if PEAK_BACKUP_TESTS
  static var documents: URL { URL(fileURLWithPath:ProcessInfo.processInfo.environment["PEAK_TEST_ROOT"]!) }
  #else
  static var documents: URL { fm.urls(for: .documentDirectory, in: .userDomainMask)[0] }
  #endif
  static var root: URL { documents.appendingPathComponent("LocalMusic", isDirectory: true) }
  #if PEAK_BACKUP_TESTS
  static var cache: URL { documents.appendingPathComponent("Cache",isDirectory:true) }
  #else
  static var cache: URL { fm.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("PeakBackups", isDirectory: true) }
  #endif
  static var rollback: URL { documents.appendingPathComponent("PeakRestorePrevious", isDirectory: true) }
  static let magic = Data("PEAKMUSIC-BACKUP-1\n".utf8)
  static func fail(_ message: String) -> BackupFailure { BackupFailure(message: message) }
  static func safe(_ name: String) -> Bool {
    guard !name.isEmpty, !name.hasPrefix("/"), !name.contains("\\"), !name.contains("\0"), !name.contains(":") else { return false }
    let parts = name.split(separator: "/", omittingEmptySubsequences: false)
    guard parts.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }) else { return false }
    if parts.count == 1 { return ["library.json", "playlists.json", "preferences.json"].contains(name) }
    return ["Music", "Artwork", "Lyrics", "PlaylistCovers"].contains(String(parts[0])) && !name.hasSuffix(".tmp") && !name.hasSuffix(".bak")
  }
  static func exact(_ handle: FileHandle, _ count: Int) throws -> Data {
    var data = Data()
    while data.count < count {
      let part = try handle.read(upToCount: count - data.count) ?? Data()
      guard !part.isEmpty else { throw fail("Sauvegarde incomplète ou tronquée.") }
      data.append(part)
    }
    return data
  }
  static func line(_ handle: FileHandle) throws -> Data {
    var data = Data()
    while data.count < 8192 {
      let b = try exact(handle, 1)
      if b[0] == 10 { return data }
      data.append(b)
    }
    throw fail("En-tête de sauvegarde invalide.")
  }
  static func recover() throws {
    if fm.fileExists(atPath: rollback.path) {
      if !fm.fileExists(atPath: root.path) { try fm.moveItem(at: rollback, to: root) }
      else { try fm.removeItem(at: rollback) }
    }
  }
  static func validate(_ directory: URL) throws -> [String: Int] {
    func array(_ name: String) throws -> [[String: Any]] {
      let url=directory.appendingPathComponent(name)
      let size=(try url.resourceValues(forKeys:[.fileSizeKey])).fileSize ?? 0
      guard size > 0, size <= 64 * 1024 * 1024,
            let value = try JSONSerialization.jsonObject(with: Data(contentsOf:url)) as? [[String:Any]] else { throw fail("Index de bibliothèque invalide.") }
      return value
    }
    let songs=try array("library.json"), playlists=try array("playlists.json")
    let ids=songs.compactMap { $0["id"] as? String }
    guard ids.count==songs.count, Set(ids).count==ids.count, ids.allSatisfy({ !$0.isEmpty && $0.range(of:"^[A-Za-z0-9_-]+$",options:.regularExpression) != nil }) else { throw fail("Identifiants de morceaux invalides.") }
    func checkPath(_ value: Any?, required: Bool = false) throws {
      if value == nil || value is NSNull { if required { throw fail("Fichier audio manquant dans la sauvegarde.") }; return }
      guard let name=value as? String, safe(name), (try directory.appendingPathComponent(name).resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey])).isRegularFile == true else { throw fail("Un fichier référencé manque dans la sauvegarde.") }
    }
    for song in songs {
      guard let title=song["title"] as? String, !title.isEmpty,
            let audio=song["audioPath"] as? String, audio.hasPrefix("Music/") else {throw fail("Métadonnées de morceau invalides.")}
      if let artist=song["artist"], !(artist is String) {throw fail("Artiste invalide.")}
      try checkPath(song["audioPath"], required:true)
      for key in ["artworkPath","customArtworkPath","lyricsPath"] { try checkPath(song[key]) }
    }
    let songSet=Set(ids), playlistIDs=playlists.compactMap{$0["id"] as? String}
    guard playlistIDs.count==playlists.count, Set(playlistIDs).count==playlistIDs.count, playlistIDs.allSatisfy({!$0.isEmpty && $0.range(of:"^[A-Za-z0-9_-]+$",options:.regularExpression) != nil}) else {throw fail("Identifiants de playlists invalides.")}
    for playlist in playlists {
      guard let name=playlist["name"] as? String, !name.isEmpty else {throw fail("Nom de playlist invalide.")}
      guard let members=playlist["songIds"] as? [String], members.allSatisfy({songSet.contains($0)}) else {throw fail("Playlist incohérente dans la sauvegarde.")}
      try checkPath(playlist["coverPath"])
    }
    let pref=directory.appendingPathComponent("preferences.json")
    if fm.fileExists(atPath:pref.path) {
      guard (try pref.resourceValues(forKeys:[.fileSizeKey])).fileSize ?? 0 < 1024 * 1024,
            (try JSONSerialization.jsonObject(with:Data(contentsOf:pref))) is [String:Any] else {throw fail("Réglages invalides.")}
    }
    return ["songs":songs.count,"playlists":playlists.count]
  }
  static func export() throws -> String {
    try recover()
    _ = try validate(root)
    try fm.createDirectory(at:cache,withIntermediateDirectories:true)
    let url=cache.appendingPathComponent("PeakMusic-\(UUID().uuidString).peakbackup")
    fm.createFile(atPath:url.path,contents:nil)
    let out=try FileHandle(forWritingTo:url)
    var success=false
    defer {try? out.close(); if !success {try? fm.removeItem(at:url)}}
    try out.write(contentsOf:magic)
    guard let entries=fm.enumerator(at:root,includingPropertiesForKeys:[.isRegularFileKey,.isSymbolicLinkKey,.fileSizeKey]) else {throw fail("Bibliothèque inaccessible.")}
    for case let file as URL in entries {
      let values=try file.resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey,.fileSizeKey])
      guard values.isSymbolicLink != true else {throw fail("Lien symbolique non pris en charge.")}
      guard values.isRegularFile == true else {continue}
      let name=String(file.path.dropFirst(root.path.count+1))
      guard safe(name) else {continue}
      let size=values.fileSize ?? 0
      let header=try JSONSerialization.data(withJSONObject:["path":name,"size":size],options:[.sortedKeys])
      guard header.count < 8192 else {throw fail("Nom de fichier trop long.")}
      try out.write(contentsOf:header);try out.write(contentsOf:Data([10]))
      let input=try FileHandle(forReadingFrom:file)
      defer {try? input.close()}
      var left=size, hash=SHA256()
      while left>0 {let data=try exact(input,min(left,1024*1024));hash.update(data:data);try out.write(contentsOf:data);left-=data.count}
      try out.write(contentsOf:Data(hash.finalize()))
    }
    try out.write(contentsOf:Data("{\"end\":true}\n".utf8))
    try out.synchronize();success=true
    return url.absoluteString
  }
  static func inspect(_ uri: String) throws -> [String:Any] {
    guard let url=URL(string:uri),url.isFileURL else {throw fail("Choisis un fichier de sauvegarde local.")}
    let access=url.startAccessingSecurityScopedResource();defer{if access{url.stopAccessingSecurityScopedResource()}}
    let input=try FileHandle(forReadingFrom:url);defer{try? input.close()}
    guard try exact(input,magic.count)==magic else {throw fail("Ce fichier n’est pas une sauvegarde Peak Music compatible.")}
    try fm.createDirectory(at:cache,withIntermediateDirectories:true)
    let stage=cache.appendingPathComponent("restore-\(UUID().uuidString)",isDirectory:true)
    try fm.createDirectory(at:stage,withIntermediateDirectories:true)
    var success=false;defer{if !success{try? fm.removeItem(at:stage)}}
    var seen=Set<String>(),total:Int64=0
    while true {
      guard let header=try JSONSerialization.jsonObject(with:line(input)) as? [String:Any] else {throw fail("Archive invalide.")}
      if header["end"] as? Bool == true {break}
      guard let name=header["path"] as? String,safe(name),!seen.contains(name.lowercased()),seen.count<100000,
            let size=header["size"] as? Int,size>=0,size<=2*1024*1024*1024 else {throw fail("Entrée de sauvegarde invalide.")}
      seen.insert(name.lowercased());total+=Int64(size)
      guard total<=100*1024*1024*1024 else {throw fail("Sauvegarde trop volumineuse.")}
      let target=stage.appendingPathComponent(name)
      try fm.createDirectory(at:target.deletingLastPathComponent(),withIntermediateDirectories:true)
      fm.createFile(atPath:target.path,contents:nil)
      let output=try FileHandle(forWritingTo:target);defer{try? output.close()}
      var left=size,hash=SHA256()
      while left>0 {let data=try exact(input,min(left,1024*1024));hash.update(data:data);try output.write(contentsOf:data);left-=data.count}
      guard try exact(input,32)==Data(hash.finalize()) else {throw fail("Sauvegarde endommagée : contrôle d’intégrité incorrect.")}
      try output.synchronize()
    }
    guard (try input.read(upToCount:1) ?? Data()).isEmpty else {throw fail("Données inattendues après la sauvegarde.")}
    let counts=try validate(stage);success=true
    return ["stage":stage.lastPathComponent,"songs":counts["songs"] ?? 0,"playlists":counts["playlists"] ?? 0,"bytes":total]
  }
  static func staged(_ token:String) throws -> URL {
    guard token.hasPrefix("restore-"),UUID(uuidString:String(token.dropFirst(8))) != nil else {throw fail("Restauration invalide.")}
    return cache.appendingPathComponent(token,isDirectory:true)
  }
  static func restore(_ token:String) throws {
    let stage=try staged(token);_ = try validate(stage);try recover()
    let exists=fm.fileExists(atPath:root.path)
    if exists {try fm.moveItem(at:root,to:rollback)}
    do {try fm.moveItem(at:stage,to:root)} catch {
      if exists {try fm.moveItem(at:rollback,to:root)}
      throw error
    }
    // Root switch succeeded; old data is no longer referenced.
    if exists {try? fm.removeItem(at:rollback)}
  }
}

