import Foundation
import AVFoundation

// Rebuilds a conventional M4A from compressed AAC samples, not asset duration.
enum M4ANormalizer {
  private struct Failure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
  }
  static func sampleDuration(_ sample: CMSampleBuffer) throws -> CMTime {
    let reported = CMSampleBufferGetDuration(sample)
    if reported.isNumeric && reported > .zero { return reported }
    guard let format = CMSampleBufferGetFormatDescription(sample),
          let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee,
          asbd.mFormatID == kAudioFormatMPEG4AAC,
          asbd.mSampleRate.isFinite, asbd.mSampleRate > 0,
          asbd.mSampleRate <= Double(Int32.max),
          asbd.mSampleRate.rounded() == asbd.mSampleRate else {
      throw Failure(message: "Durée AAC absente et format audio inexploitable.")
    }
    var descriptions: UnsafePointer<AudioStreamPacketDescription>?
    var size = 0
    let status = CMSampleBufferGetAudioStreamPacketDescriptionsPtr(
      sample, packetDescriptionsPointerOut: &descriptions, sizeOut: &size)
    let count = CMSampleBufferGetNumSamples(sample)
    guard status == noErr, count > 0 else {
      throw Failure(message: "Impossible de lire les paquets AAC (code \(status)).")
    }
    var frames: Int64 = 0
    if let descriptions, size > 0 {
      let stride = MemoryLayout<AudioStreamPacketDescription>.stride
      guard size % stride == 0, size / stride == count else {
        throw Failure(message: "Nombre de paquets AAC incohérent.")
      }
      for index in 0..<count {
        let variableFrames = descriptions[index].mVariableFramesInPacket
        let packetFrames = variableFrames > 0 ? variableFrames : asbd.mFramesPerPacket
        guard packetFrames > 0 else { throw Failure(message: "Durée du paquet AAC inconnue.") }
        let sum = frames.addingReportingOverflow(Int64(packetFrames))
        guard !sum.overflow else { throw Failure(message: "Durée AAC hors limites.") }
        frames = sum.partialValue
      }
    } else {
      guard asbd.mFramesPerPacket > 0 else { throw Failure(message: "Durée AAC inconnue.") }
      let total = Int64(count).multipliedReportingOverflow(by: Int64(asbd.mFramesPerPacket))
      guard !total.overflow else { throw Failure(message: "Durée AAC hors limites.") }
      frames = total.partialValue
    }
    // Frames are per channel already: never multiply by the channel count.
    return CMTime(value: frames, timescale: Int32(asbd.mSampleRate))
  }

  static func normalize(source: String, destination: String) async throws -> [String: String] {
    let fm = FileManager.default
    let roots = [fm.urls(for: .documentDirectory, in: .userDomainMask)[0], fm.urls(for: .cachesDirectory, in: .userDomainMask)[0]]
    func local(_ raw: String) throws -> URL {
      guard let url = URL(string: raw), url.isFileURL, url.pathExtension.lowercased() == "m4a" else {
        throw Failure(message: "Fichier M4A local requis.")
      }
      let resolved = url.resolvingSymlinksInPath().standardizedFileURL
      guard roots.contains(where: { resolved.path.hasPrefix($0.resolvingSymlinksInPath().standardizedFileURL.path + "/") }) else {
        throw Failure(message: "Fichier en dehors du stockage de Peak Music.")
      }
      return resolved
    }
    let inputURL = try local(source)
    let outputURL = try local(destination)
    guard inputURL != outputURL, !fm.fileExists(atPath: outputURL.path) else {
      throw Failure(message: "La réparation doit créer un nouveau fichier.")
    }
    let asset = AVURLAsset(url: inputURL, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
    let tracks = try await asset.loadTracks(withMediaType: .audio)
    guard tracks.count == 1, let track = tracks.first else {
      throw Failure(message: "Une seule piste audio est requise.")
    }
    let formats = try await track.load(.formatDescriptions)
    guard let format = formats.first, CMFormatDescriptionGetMediaSubType(format) == kAudioFormatMPEG4AAC else {
      throw Failure(message: "Réparation M4A limitée aux pistes AAC.")
    }
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
    output.alwaysCopiesSampleData = false
    guard reader.canAdd(output) else { throw Failure(message: "Lecture AAC impossible.") }
    reader.add(output)
    let writer = try AVAssetWriter(outputURL: outputURL, fileType: .m4a)
    var success = false
    defer {
      reader.cancelReading()
      if !success { writer.cancelWriting(); try? fm.removeItem(at: outputURL) }
    }
    // nil outputSettings preserves compressed AAC without reencoding.
    let input = AVAssetWriterInput(mediaType: .audio, outputSettings: nil, sourceFormatHint: format)
    input.expectsMediaDataInRealTime = false
    guard writer.canAdd(input) else { throw Failure(message: "Écriture AAC sans conversion impossible.") }
    writer.add(input)
    writer.shouldOptimizeForNetworkUse = true
    writer.metadata = try await asset.load(.metadata)
    guard reader.startReading(), writer.startWriting() else {
      throw Failure(message: "Impossible de démarrer la réparation M4A.")
    }
    var start: CMTime?
    var end = CMTime.zero
    var lastPTS: CMTime?
    var packetCount = 0
    let deadline = Date().addingTimeInterval(600)
    while true {
      try Task.checkCancellation()
      guard Date() < deadline else { throw Failure(message: "Délai de réparation M4A dépassé.") }
      if !input.isReadyForMoreMediaData {
        guard writer.status == .writing else { throw writer.error ?? Failure(message: "Écriture M4A interrompue.") }
        try await Task.sleep(nanoseconds: 5_000_000)
        continue
      }
      guard let sample = output.copyNextSampleBuffer() else { break }
      let pts = CMSampleBufferGetPresentationTimeStamp(sample)
      // Compressed audio buffers may omit aggregate duration. Their packet
      // descriptions + ASBD still define the exact number of audio frames.
      let count = CMSampleBufferGetNumSamples(sample)
      if count == 0 && CMSampleBufferGetTotalSampleSize(sample) == 0 { continue }
      guard pts.isNumeric else {
        throw Failure(message: "Position AAC absente (buffer \(packetCount)) : réparation interrompue.")
      }
      let duration = try sampleDuration(sample)

      if let lastPTS, pts < lastPTS { throw Failure(message: "Horodatage AAC non ordonné.") }
      if start == nil { start = pts; writer.startSession(atSourceTime: pts) }
      guard input.append(sample) else { throw writer.error ?? Failure(message: "Copie AAC impossible.") }
      end = CMTimeMaximum(end, CMTimeAdd(pts, duration))
      lastPTS = pts
      packetCount += CMSampleBufferGetNumSamples(sample)
    }
    guard reader.status == .completed, let start, packetCount > 0 else {
      throw reader.error ?? Failure(message: "Lecture M4A incomplète : original conservé.")
    }
    writer.endSession(atSourceTime: end)
    input.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else { throw writer.error ?? Failure(message: "Finalisation M4A impossible.") }
    let expected = CMTimeSubtract(end, start).seconds
    let rebuilt = AVURLAsset(url: outputURL, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
    let actual = try await rebuilt.load(.duration).seconds
    guard actual.isFinite, expected > 0, abs(actual - expected) < 0.15 else {
      throw Failure(message: "Durée reconstruite incohérente : original conservé.")
    }
    success = true
    return ["uri": outputURL.absoluteString, "duration": String(actual)]
  }
}
