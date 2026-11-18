// Exercise the patched native end-of-track method with deferred seek completion.
const fs=require('node:fs');
const source=fs.readFileSync('node_modules/@rntp/player/ios/player/AudioPlayer.swift','utf8');
function method(signature){const start=source.indexOf(signature);if(start<0)throw Error(signature);let end=source.indexOf('{',start),depth=1;while(depth&&++end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}return source.slice(start,end+1).replace('private func','func');}
const swift=`import Foundation
 enum RepeatMode { case off, track, queue }
 enum State { case ended, playing }
 final class Engine {
 var pending: ((Bool)->Void)?; var plays=0
 func pause() {}
 func seek(to: Double, completion: @escaping (Bool)->Void) { pending=completion }
 }
 final class Queue {
 var currentIndex=0; var items=[1]
 func next(wrap:Bool) {}
 }
 final class Subject {
 let engine=Engine(); let queue=Queue(); var repeatMode=RepeatMode.track
 var peakPlaybackGeneration=0; var playWhenReady=true; var state=State.playing
 var loads=0; var deactivations=0
 func play() { engine.plays += 1 }
 func loadCurrentItem(autoplay:Bool) { loads += 1 }
 func deactivateAudioSession() { deactivations += 1 }
 ${method('  private func handleItemDidPlayToEnd()')}
 ${method('  func pause()')}
 }
 let normal=Subject(); normal.handleItemDidPlayToEnd()
 precondition(normal.engine.plays==0, "Replay must wait for seek")
 normal.engine.pending?(true); precondition(normal.engine.plays==1)
 let paused=Subject(); paused.handleItemDidPlayToEnd(); paused.pause(); paused.engine.pending?(true)
 precondition(paused.engine.plays==0, "Do not override user pause")
 let stale=Subject(); stale.handleItemDidPlayToEnd(); stale.peakPlaybackGeneration += 1; stale.engine.pending?(true)
 precondition(stale.engine.plays==0, "Do not restart a superseded item")
 let failed=Subject(); failed.handleItemDidPlayToEnd(); failed.engine.pending?(false)
 precondition(failed.engine.plays==0, "Do not play after cancelled seek")
 let stopped=Subject(); stopped.playWhenReady=false; stopped.handleItemDidPlayToEnd()
 precondition(stopped.engine.pending==nil)
 let all=Subject(); all.repeatMode = .queue; all.handleItemDidPlayToEnd(); precondition(all.loads==1)
 let off=Subject(); off.repeatMode = .off; off.handleItemDidPlayToEnd(); precondition(off.deactivations==1)
 print("Native repeat sequencing: 7 checks passed")
`;
fs.writeFileSync('/tmp/peak-repeat-test.swift',swift);
