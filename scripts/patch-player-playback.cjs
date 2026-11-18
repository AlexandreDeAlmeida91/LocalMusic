const fs=require('node:fs'),path=require('node:path');
function replaceOnce(source,before,after){if(source.includes(after))return source;if(source.split(before).length!==2)throw Error('RNTP playback source changed: review patch before building.');return source.replace(before,after);}
function patch(source){
 source=replaceOnce(source,'  private var artworkToken = 0',`  private var artworkToken = 0
  // Peak Music: invalidate delayed repeat completions after user actions.
  private var peakPlaybackGeneration = 0
  #if canImport(UIKit)
  private var peakLifecycleObservers: [NSObjectProtocol] = []
  #endif`);
 source=replaceOnce(source,'import MediaPlayer','import MediaPlayer\nimport UIKit');
 source=replaceOnce(source,'  // MARK: - Playback',`  deinit {
    #if canImport(UIKit)
    peakLifecycleObservers.forEach { NotificationCenter.default.removeObserver($0) }
    #endif
  }

  // MARK: - Playback`);
 source=replaceOnce(source,`      return (self.duration, self.currentTime, self.state == .playing ? Double(self.rate) : 0.0)
    }
  }`,`      return (self.duration, self.currentTime, self.state == .playing ? Double(self.rate) : 0.0)
    }
    #if canImport(UIKit)
    // Restore the system playback snapshot without restarting or seeking audio.
    for name in [UIApplication.didEnterBackgroundNotification, UIApplication.didBecomeActiveNotification] {
      peakLifecycleObservers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        guard let self, self.playWhenReady, self.engine.isPlaying else { return }
        self.activateAudioSession()
        self.updateNowPlayingPlaybackInfo()
      })
    }
    #endif
  }`);
 for(const signature of ['  func pause() {','  func stop() {','  func seek(to seconds: TimeInterval) {','  private func loadCurrentItem(autoplay: Bool) {'])source=replaceOnce(source,signature,signature+'\n    peakPlaybackGeneration &+= 1');
 source=replaceOnce(source,`    activateAudioSession()
    playWhenReady = true`,`    activateAudioSession()
    updateNowPlayingPlaybackInfo()
    playWhenReady = true`);
 source=replaceOnce(source,`    case .playing:
      state = .playing`,`    case .playing:
      activateAudioSession()
      state = .playing
      updateNowPlayingPlaybackInfo()`);
 source=replaceOnce(source,`    if repeatMode == .track {
      engine.pause()
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.032) { [weak self] in
        self?.seek(to: 0)
        self?.engine.play()
      }`,`    if repeatMode == .track {
      guard playWhenReady else { return }
      peakPlaybackGeneration &+= 1
      let generation = peakPlaybackGeneration
      engine.pause()
      // AVPlayer seeking is asynchronous: replay only after it actually reaches zero.
      engine.seek(to: 0) { [weak self] finished in
        guard let self, finished, self.playWhenReady,
              self.peakPlaybackGeneration == generation else { return }
        self.play()
      }`);
 source=replaceOnce(source,`    try? AVAudioSession.sharedInstance().setActive(true)`,`    let session = AVAudioSession.sharedInstance()
    // Another media operation may have changed the process-wide audio category.
    if session.category != .playback {
      try? session.setCategory(.playback, mode: .default)
    }
    try? session.setActive(true)`);
 return source;
}
if(require.main===module){const root=path.resolve(__dirname,'..'),pkg=require(path.join(root,'node_modules/@rntp/player/package.json'));if(pkg.version!=='5.9.2')throw Error('Review playback patch for RNTP '+pkg.version);const file=path.join(root,'node_modules/@rntp/player/ios/player/AudioPlayer.swift');fs.writeFileSync(file,patch(fs.readFileSync(file,'utf8')));console.log('Peak Music: native repeat and Now Playing recovery applied.');}
module.exports={patch};
