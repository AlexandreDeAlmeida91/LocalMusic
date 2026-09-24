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
  useAudioPlaylist,
  useAudioPlaylistStatus
} from 'expo-audio';
import {
  deleteSongFile,
  loadLibrary,
  pickAndImportSongs,
  saveLibrary
} from '../services/library';
import {
  loadPlaylists,
  savePlaylists
} from '../services/playlists';

const MusicContext = createContext(null);

function lockScreenMetadata(song) {
  return {
    title: song.title,
    artist: song.artist,
    albumTitle: song.album,
    artworkUrl: song.artworkUri || undefined
  };
}

function sameIds(a, b) {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export function MusicProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [importing, setImporting] = useState(false);
  const [currentSongId, setCurrentSongId] = useState(null);
  const [activeQueueName, setActiveQueueName] = useState('Bibliothèque');
  const [playerVisible, setPlayerVisible] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState(null);

  const nativePlaylist = useAudioPlaylist({
    sources: [],
    loop: 'all',
    updateInterval: 250
  });
  const status = useAudioPlaylistStatus(nativePlaylist);

  const queueIdsRef = useRef([]);

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

        const [storedSongs, storedPlaylists] = await Promise.all([
          loadLibrary(),
          loadPlaylists()
        ]);

        const validSongIds = new Set(storedSongs.map((song) => song.id));
        const cleanedPlaylists = storedPlaylists.map((playlist) => ({
          ...playlist,
          songIds: (playlist.songIds || []).filter((id) => validSongIds.has(id))
        }));

        setSongs(storedSongs);
        setPlaylists(cleanedPlaylists);

        if (JSON.stringify(cleanedPlaylists) !== JSON.stringify(storedPlaylists)) {
          await savePlaylists(cleanedPlaylists);
        }
      } catch (e) {
        setError(e?.message || 'Impossible de charger la bibliothèque.');
      } finally {
        setLoadingLibrary(false);
      }
    })();
  }, []);

  useEffect(() => {
    nativePlaylist.volume = volume;
  }, [nativePlaylist, volume]);

  const activateLockScreen = useCallback(
    (song) => {
      try {
        nativePlaylist.setActiveForLockScreen(true, lockScreenMetadata(song));
      } catch {
        // Normal dans Expo Go ; le vrai build iOS dispose de ces contrôles.
      }
    },
    [nativePlaylist]
  );

  const buildNativeQueue = useCallback(
    (queueSongs, queueName = 'Bibliothèque') => {
      const validSongs = queueSongs.filter(Boolean);
      const ids = validSongs.map((song) => song.id);

      nativePlaylist.clear();

      for (const song of validSongs) {
        nativePlaylist.add({
          uri: song.uri,
          name: song.title
        });
      }

      queueIdsRef.current = ids;
      setActiveQueueName(queueName);

      return validSongs;
    },
    [nativePlaylist]
  );

  useEffect(() => {
    const index = status.currentIndex;
    if (!Number.isInteger(index) || index < 0) return;

    const songId = queueIdsRef.current[index];
    if (!songId) return;

    const song = songs.find((item) => item.id === songId);
    if (!song) return;

    if (song.id !== currentSongId) {
      setCurrentSongId(song.id);
    }

    try {
      nativePlaylist.updateLockScreenMetadata(lockScreenMetadata(song));
    } catch {
      // Pas critique pour la lecture.
    }
  }, [currentSongId, nativePlaylist, songs, status.currentIndex]);

  const playSong = useCallback(
    (song, queueSongs = songs, openPlayer = false, queueName = 'Bibliothèque') => {
      try {
        const desiredIds = queueSongs.map((item) => item.id);
        const queueChanged = !sameIds(queueIdsRef.current, desiredIds);

        if (queueChanged || nativePlaylist.trackCount !== desiredIds.length) {
          buildNativeQueue(queueSongs, queueName);
        } else {
          setActiveQueueName(queueName);
        }

        const index = desiredIds.indexOf(song.id);
        if (index < 0) return;

        setCurrentSongId(song.id);
        nativePlaylist.skipTo(index);
        activateLockScreen(song);
        nativePlaylist.play();

        if (openPlayer) setPlayerVisible(true);
      } catch (e) {
        setError(e?.message || `Impossible de lire « ${song.title} ».`);
      }
    },
    [activateLockScreen, buildNativeQueue, nativePlaylist, songs]
  );

  const playQueue = useCallback(
    (queueSongs, queueName = 'Playlist') => {
      if (!queueSongs.length) return;

      try {
        const built = buildNativeQueue(queueSongs, queueName);
        if (!built.length) return;

        const firstSong = built[0];
        setCurrentSongId(firstSong.id);
        nativePlaylist.skipTo(0);
        activateLockScreen(firstSong);
        nativePlaylist.play();
      } catch (e) {
        setError(e?.message || 'Impossible de démarrer cette playlist.');
      }
    },
    [activateLockScreen, buildNativeQueue, nativePlaylist]
  );

  const togglePlayPause = useCallback(() => {
    if (!currentSong) return;

    try {
      if (status.playing) {
        nativePlaylist.pause();
      } else {
        activateLockScreen(currentSong);
        nativePlaylist.play();
      }
    } catch (e) {
      setError(e?.message || 'Impossible de modifier la lecture.');
    }
  }, [activateLockScreen, currentSong, nativePlaylist, status.playing]);

  const next = useCallback(() => {
    if (!queueIdsRef.current.length) return;

    try {
      nativePlaylist.next();
    } catch (e) {
      setError(e?.message || 'Impossible de passer au morceau suivant.');
    }
  }, [nativePlaylist]);

  const previous = useCallback(async () => {
    if (!queueIdsRef.current.length) return;

    try {
      if ((status.currentTime || 0) > 3) {
        await nativePlaylist.seekTo(0);
        return;
      }

      nativePlaylist.previous();
    } catch (e) {
      setError(e?.message || 'Impossible de revenir au morceau précédent.');
    }
  }, [nativePlaylist, status.currentTime]);

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
        const updatedSongs = songs.filter((item) => item.id !== song.id);
        const updatedPlaylists = playlists.map((playlist) => ({
          ...playlist,
          songIds: playlist.songIds.filter((id) => id !== song.id),
          updatedAt: new Date().toISOString()
        }));

        if (song.id === currentSongId) {
          nativePlaylist.pause();
          nativePlaylist.clearLockScreenControls();
          nativePlaylist.clear();
          queueIdsRef.current = [];
          setCurrentSongId(null);
        } else if (queueIdsRef.current.includes(song.id)) {
          const remainingIds = queueIdsRef.current.filter((id) => id !== song.id);
          const remainingSongs = remainingIds
            .map((id) => updatedSongs.find((item) => item.id === id))
            .filter(Boolean);

          const wasPlaying = Boolean(status.playing);
          const keepCurrentId = currentSongId;

          buildNativeQueue(remainingSongs, activeQueueName);

          if (keepCurrentId) {
            const index = remainingSongs.findIndex((item) => item.id === keepCurrentId);
            if (index >= 0) {
              nativePlaylist.skipTo(index);
              if (wasPlaying) nativePlaylist.play();
            }
          }
        }

        setSongs(updatedSongs);
        setPlaylists(updatedPlaylists);

        await Promise.all([
          saveLibrary(updatedSongs),
          savePlaylists(updatedPlaylists),
          deleteSongFile(song)
        ]);
      } catch (e) {
        setError(e?.message || 'Impossible de supprimer ce morceau.');
      }
    },
    [
      activeQueueName,
      buildNativeQueue,
      currentSongId,
      nativePlaylist,
      playlists,
      songs,
      status.playing
    ]
  );

  const createPlaylist = useCallback(
    async (name) => {
      const cleanedName = name.trim();

      if (!cleanedName) {
        setError('Donne un nom à la playlist.');
        return null;
      }

      if (
        playlists.some(
          (playlist) => playlist.name.toLocaleLowerCase() === cleanedName.toLocaleLowerCase()
        )
      ) {
        setError('Une playlist porte déjà ce nom.');
        return null;
      }

      const now = new Date().toISOString();
      const playlist = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name: cleanedName,
        songIds: [],
        createdAt: now,
        updatedAt: now
      };

      const updated = [...playlists, playlist].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
      );

      setPlaylists(updated);
      await savePlaylists(updated);
      return playlist;
    },
    [playlists]
  );

  const renamePlaylist = useCallback(
    async (playlistId, name) => {
      const cleanedName = name.trim();
      if (!cleanedName) return;

      const updated = playlists
        .map((playlist) =>
          playlist.id === playlistId
            ? { ...playlist, name: cleanedName, updatedAt: new Date().toISOString() }
            : playlist
        )
        .sort((a, b) =>
          a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
        );

      setPlaylists(updated);
      await savePlaylists(updated);
    },
    [playlists]
  );

  const deletePlaylist = useCallback(
    async (playlistId) => {
      const updated = playlists.filter((playlist) => playlist.id !== playlistId);
      setPlaylists(updated);
      await savePlaylists(updated);
    },
    [playlists]
  );

  const updatePlaylistSongs = useCallback(
    async (playlistId, songIds) => {
      const validIds = new Set(songs.map((song) => song.id));
      const uniqueIds = [...new Set(songIds)].filter((id) => validIds.has(id));

      const updated = playlists.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              songIds: uniqueIds,
              updatedAt: new Date().toISOString()
            }
          : playlist
      );

      setPlaylists(updated);
      await savePlaylists(updated);
    },
    [playlists, songs]
  );

  const removeSongFromPlaylist = useCallback(
    async (playlistId, songId) => {
      const playlist = playlists.find((item) => item.id === playlistId);
      if (!playlist) return;

      await updatePlaylistSongs(
        playlistId,
        playlist.songIds.filter((id) => id !== songId)
      );
    },
    [playlists, updatePlaylistSongs]
  );

  const songsForPlaylist = useCallback(
    (playlist) =>
      (playlist?.songIds || [])
        .map((id) => songs.find((song) => song.id === id))
        .filter(Boolean),
    [songs]
  );

  const seekTo = useCallback(
    async (seconds) => {
      try {
        await nativePlaylist.seekTo(seconds);
      } catch {
        // Ignore un seek pendant le chargement.
      }
    },
    [nativePlaylist]
  );

  const setVolume = useCallback(
    (value) => {
      const nextVolume = Math.min(1, Math.max(0, value));
      setVolumeState(nextVolume);
      nativePlaylist.volume = nextVolume;
    },
    [nativePlaylist]
  );

  const value = {
    songs,
    playlists,
    loadingLibrary,
    importing,
    error,
    clearError: () => setError(null),

    currentSong,
    activeQueueName,
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
    playQueue,
    togglePlayPause,
    next,
    previous,
    seekTo,
    setVolume,

    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    updatePlaylistSongs,
    removeSongFromPlaylist,
    songsForPlaylist
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
