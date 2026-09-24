import TrackPlayer, {
  PlayerCommand,
  RepeatMode
} from '@rntp/player';

let setupPromise = null;

export function configureRemoteCommands() {
  TrackPlayer.setCommands({
    capabilities: [
      PlayerCommand.PlayPause,
      PlayerCommand.Next,
      PlayerCommand.Previous,
      PlayerCommand.Seek
    ],
    handling: 'native'
  });
}

export async function ensurePlayer() {
  if (!setupPromise) {
    setupPromise = (async () => {
      await TrackPlayer.setupPlayer({
        contentType: 'music',
        handleAudioBecomingNoisy: true
      });

      // Initial configuration. We also refresh these commands each time
      // a real media queue is loaded because iOS can otherwise keep
      // Next/Previous/Seek disabled from the initial empty-queue state.
      configureRemoteCommands();

      TrackPlayer.setRepeatMode(RepeatMode.Off);
      TrackPlayer.setShuffleEnabled(false);
      TrackPlayer.setVolume(1);
    })();
  }

  return setupPromise;
}

export function nativeRepeatMode(mode) {
  switch (mode) {
    case 'one':
      return RepeatMode.One;
    case 'all':
      return RepeatMode.All;
    default:
      return RepeatMode.Off;
  }
}

export function songToMediaItem(song) {
  const artwork =
    typeof song.artworkUri === 'string' &&
    !song.artworkUri.startsWith('data:')
      ? song.artworkUri
      : undefined;

  return {
    mediaId: song.id,
    url: song.uri,
    title: song.title,
    artist: song.artist,
    albumTitle: song.album,
    artworkUrl: artwork,
    mimeType: 'audio/mpeg',
    extras: {
      localMusicSongId: song.id
    }
  };
}

export { TrackPlayer };
