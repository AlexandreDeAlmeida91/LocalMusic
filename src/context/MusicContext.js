import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus
} from 'expo-audio';
import {
  deleteSongFile,
  loadLibrary,
  pickAndImportSongs,
  saveLibrary
} from '../services/library';

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [importing, setImporting] = useState(false);
  const [currentSongId, setCurrentSongId] = useState(null);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState(null);

  const player = useAudioPlayer(null, {
    updateInterval: 250,
    downloadFirst: false
  });
  const status = useAudioPlayerStatus(player);
  const finishHandledRef = useRef(false);

  const currentSong = useMemo(
    () => songs.find((song) => song.id === currentSongId) || null,
    [songs, currentSongId]
  );

  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'doNotMix'
        });

        const stored = await loadLibrary();
        setSongs(stored);
      } catch (e) {
        setError(e?.message || 'Impossible de charger la bibliothèque.');
      } finally {
        setLoadingLibrary(false);
      }
    })();
  }, []);

  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);

  const activateLockScreen = useCallback(
    (song) => {
      try {
        player.setActiveForLockScreen(true, {
          title: song.title,
          artist: song.artist,
          albumTitle: song.album,
          artworkUrl: song.artworkUri || undefined
        });
      } catch {
        // Les contrôles système peuvent être indisponibles dans Expo Go.
      }
    },
    [player]
  );

  const playSong = useCallback(
    (song, openPlayer = false) => {
      try {
        finishHandledRef.current = false;
        setCurrentSongId(song.id);
        player.replace(song.uri);
        activateLockScreen(song);
        player.play();

        if (openPlayer) setPlayerVisible(true);
      } catch (e) {
        setError(e?.message || `Impossible de lire « ${song.title} ».`);
      }
    },
    [activateLockScreen, player]
  );

  const togglePlayPause = useCallback(() => {
    if (!currentSong) return;

    try {
      if (status.playing) {
        player.pause();
      } else {
        activateLockScreen(currentSong);
        player.play();
      }
    } catch (e) {
      setError(e?.message || 'Impossible de modifier la lecture.');
    }
  }, [activateLockScreen, currentSong, player, status.playing]);

  const next = useCallback(() => {
    if (!songs.length) return;

    const currentIndex = Math.max(
      0,
      songs.findIndex((song) => song.id === currentSongId)
    );
    const nextIndex = (currentIndex + 1) % songs.length;
    playSong(songs[nextIndex]);
  }, [currentSongId, playSong, songs]);

  const previous = useCallback(async () => {
    if (!songs.length) return;

    if ((status.currentTime || 0) > 3) {
      await player.seekTo(0);
      return;
    }

    const foundIndex = songs.findIndex((song) => song.id === currentSongId);
    const currentIndex = foundIndex < 0 ? 0 : foundIndex;
    const previousIndex = (currentIndex - 1 + songs.length) % songs.length;
    playSong(songs[previousIndex]);
  }, [currentSongId, playSong, player, songs, status.currentTime]);

  useEffect(() => {
    if (status.didJustFinish && !finishHandledRef.current && currentSongId) {
      finishHandledRef.current = true;
      next();
    }

    if (!status.didJustFinish) {
      finishHandledRef.current = false;
    }
  }, [currentSongId, next, status.didJustFinish]);

  const importSongs = useCallback(async () => {
    setImporting(true);
    setError(null);

    try {
      const imported = await pickAndImportSongs();
      if (!imported.length) return;

      const merged = [...songs, ...imported].sort((a, b) =>
        a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
      );

      setSongs(merged);
      await saveLibrary(merged);
    } catch (e) {
      setError(e?.message || 'Impossible d’importer les fichiers MP3.');
    } finally {
      setImporting(false);
    }
  }, [songs]);

  const removeSong = useCallback(
    async (song) => {
      try {
        if (song.id === currentSongId) {
          player.pause();
          player.clearLockScreenControls();
          setCurrentSongId(null);
        }

        const updated = songs.filter((item) => item.id !== song.id);
        setSongs(updated);

        await Promise.all([
          saveLibrary(updated),
          deleteSongFile(song)
        ]);
      } catch (e) {
        setError(e?.message || 'Impossible de supprimer ce morceau.');
      }
    },
    [currentSongId, player, songs]
  );

  const seekTo = useCallback(
    async (seconds) => {
      try {
        await player.seekTo(seconds);
      } catch {
        // Ignore un seek pendant le chargement du morceau.
      }
    },
    [player]
  );

  const setVolume = useCallback(
    (value) => {
      const nextVolume = Math.min(1, Math.max(0, value));
      setVolumeState(nextVolume);
      player.volume = nextVolume;
    },
    [player]
  );

  const value = {
    songs,
    loadingLibrary,
    importing,
    error,
    clearError: () => setError(null),

    currentSong,
    isPlaying: Boolean(status.playing),
    currentTime: status.currentTime || 0,
    duration: status.duration || 0,
    isBuffering: Boolean(status.isBuffering),
    volume,

    playerVisible,
    setPlayerVisible,

    importSongs,
    removeSong,
    playSong,
    togglePlayPause,
    next,
    previous,
    seekTo,
    setVolume
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic doit être utilisé dans MusicProvider.');
  }
  return context;
}
