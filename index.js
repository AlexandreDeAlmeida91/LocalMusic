import { registerRootComponent } from 'expo';
import TrackPlayer, { Event } from '@rntp/player';
import App from './App';

TrackPlayer.registerPlaybackSession(() => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    try {
      TrackPlayer.skipToNext();
    } catch {
      // End of queue with repeat disabled.
    }
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    try {
      TrackPlayer.skipToPrevious();
    } catch {
      // Beginning of queue.
    }
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    if (Number.isFinite(position)) {
      TrackPlayer.seekTo(position);
    }
  });
});

registerRootComponent(App);
