import Foundation
import AVFoundation

@main struct NativeM4ATests {
  static func packets(_ url: URL) async throws -> Data {
    let asset = AVURLAsset(url: url)
    let tracks = try await asset.loadTracks(withMediaType: .audio)
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: tracks[0], outputSettings: nil)
    reader.add(output)
    precondition(reader.startReading())
    var data = Data()
    while let sample = output.copyNextSampleBuffer() {
      if let block = CMSampleBufferGetDataBuffer(sample) {
        let length = CMBlockBufferGetDataLength(block)
        var bytes = [UInt8](repeating: 0, count: length)
        let status = bytes.withUnsafeMutableBytes {
          CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: $0.baseAddress!)
        }
        precondition(status == noErr)
        data.append(contentsOf: bytes)
      }
      // Reproduce a missing aggregate duration while retaining packet metadata.
      if CMSampleBufferGetNumSamples(sample) > 0 {
        var timing = CMSampleTimingInfo(duration: .invalid,
          presentationTimeStamp: CMSampleBufferGetPresentationTimeStamp(sample), decodeTimeStamp: .invalid)
        var untimed: CMSampleBuffer?
        let status = CMSampleBufferCreateCopyWithNewTiming(allocator: kCFAllocatorDefault,
          sampleBuffer: sample, sampleTimingEntryCount: 1, sampleTimingArray: &timing,
          sampleBufferOut: &untimed)
        precondition(status == noErr)
        let recovered = try M4ANormalizer.sampleDuration(untimed!)
        precondition(recovered.isNumeric && recovered > .zero)
        let expected = Double(CMSampleBufferGetNumSamples(sample)) * 1024.0 / 44100.0
        precondition(abs(recovered.seconds - expected) < 0.00001)
      }
    }
    precondition(reader.status == .completed)
    return data
  }
  static func main() async throws {
    let fm = FileManager.default
    let directory = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("PeakM4ATest-" + UUID().uuidString)
    try fm.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? fm.removeItem(at: directory) }
    let source = directory.appendingPathComponent("source.m4a")
    let result = directory.appendingPathComponent("result.m4a")
    try fm.copyItem(at: URL(fileURLWithPath: CommandLine.arguments[1]), to: source)
    let original = try Data(contentsOf: source)
    let before = try await packets(source)
    let info = try await M4ANormalizer.normalize(source: source.absoluteString, destination: result.absoluteString)
    let after = try await packets(result)
    precondition(!before.isEmpty && before == after, "AAC packets changed")
    let unchanged = try Data(contentsOf: source)
    precondition(unchanged == original, "Original changed")
    let duration = Double(info["duration"]!)!
    precondition(duration > 2.2 && duration < 2.4, "Duration doubled or truncated")
    print("Native M4A: missing duration recovered, AAC bytes preserved, original intact, duration \(duration)s")
  }
}
