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
  useActiveMediaItem,
  useIsPlaying,
  useProgress
} from '@rntp/player';
import {
  deleteSongFile,
  loadLibrary,
  pickAndImportSongs,
  saveLibrary
} from '../services/library';
import {
  deletePlaylistCover,
  loadPlaylists,
  pickPlaylistCover,
  savePlaylists
} from '../services/playlists';
import {
  ensurePlayer,
  nativeRepeatMode,
  songToMediaItem,
  TrackPlayer
} from '../services/player';

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [importing, setImporting] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [activeQueueName, setActiveQueueName] = useState('Bibliothèque');
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatModeState] = useState('off');
  const [playerVisible, setPlayerVisible] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState(null);

  const activeQueueIdsRef = useRef([]);

  const activeMediaItem = useActiveMediaItem();
  const isPlaying = useIsPlaying();
  const progress = useProgress(0.5);

  const currentSong = useMemo(() => {
    const id =
      activeMediaItem?.mediaId ||
      activeMediaItem?.extras?.localMusicSongId;

    if (!id) return null;
    return songs.find((song) => song.id === id) || null;
  }, [activeMediaItem, songs]);

  useEffect(() => {
    (async () => {
      try {
        await ensurePlayer();
        setPlayerReady(true);

        const [storedSongs, storedPlaylists] = await Promise.all([
          loadLibrary(),
          loadPlaylists()
        ]);

        const validSongIds = new Set(storedSongs.map((song) => song.id));
        const cleanedPlaylists = storedPlaylists.map((playlist) => ({
          ...playlist,
          songIds: (playlist.songIds || []).filter((id) =>
            validSongIds.has(id)
          )
        }));

        setSongs(storedSongs);
        setPlaylists(cleanedPlaylists);

        if (
          JSON.stringify(cleanedPlaylists) !==
          JSON.stringify(storedPlaylists)
        ) {
          await savePlaylists(cleanedPlaylists);
        }
      } catch (e) {
        setError(
          e?.message ||
          'Impossible d’initialiser le lecteur audio natif.'
        );
      } finally {
        setLoadingLibrary(false);
      }
    })();
  }, []);

  const setNativeQueue = useCallback(
    async (
      queueSongs,
      queueName,
      startIndex = 0,
      autoPlay = true
    ) => {
      await ensurePlayer();

      const validSongs = queueSongs.filter(Boolean);
      if (!validSongs.length) return;

      const safeIndex = Math.max(
        0,
        Math.min(startIndex, validSongs.length - 1)
      );

      TrackPlayer.setMediaItems(
        validSongs.map(songToMediaItem),
        safeIndex
      );

      TrackPlayer.setShuffleEnabled(shuffleEnabled);
      TrackPlayer.setRepeatMode(nativeRepeatMode(repeatMode));
      TrackPlayer.setVolume(volume);

      activeQueueIdsRef.current = validSongs.map((song) => song.id);
      setActiveQueueName(queueName || 'Bibliothèque');

      if (autoPlay) {
        TrackPlayer.play();
      }
    },
    [repeatMode, shuffleEnabled, volume]
  );

  const playSong = useCallback(
    async (
      song,
      queueSongs = songs,
      openPlayer = false,
      queueName = 'Bibliothèque'
    ) => {
      try {
        const index = queueSongs.findIndex(
          (item) => item.id === song.id
        );

        if (index < 0) return;

        await setNativeQueue(
          queueSongs,
          queueName,
          index,
          true
        );

        if (openPlayer) setPlayerVisible(true);
      } catch (e) {
        setError(
          e?.message ||
          `Impossible de lire « ${song.title} ».`
        );
      }
    },
    [setNativeQueue, songs]
  );

  const playQueue = useCallback(
    async (queueSongs, queueName = 'Playlist') => {
      try {
        await setNativeQueue(queueSongs, queueName, 0, true);
      } catch (e) {
        setError(
          e?.message ||
          'Impossible de démarrer cette file de lecture.'
        );
      }
    },
    [setNativeQueue]
  );

  const togglePlayPause = useCallback(() => {
    if (!playerReady || !currentSong) return;

    try {
      if (isPlaying) {
        TrackPlayer.pause();
      } else {
        TrackPlayer.play();
      }
    } catch (e) {
      setError(
        e?.message ||
        'Impossible de modifier la lecture.'
      );
    }
  }, [currentSong, isPlaying, playerReady]);

  const next = useCallback(() => {
    if (!playerReady || !currentSong) return;

    try {
      TrackPlayer.skipToNext();
    } catch {
      // Fin de file avec répétition désactivée.
    }
  }, [currentSong, playerReady]);

  const previous = useCallback(() => {
    if (!playerReady || !currentSong) return;

    try {
      if ((progress.position || 0) > 3) {
        TrackPlayer.seekTo(0);
      } else {
        TrackPlayer.skipToPrevious();
      }
    } catch {
      TrackPlayer.seekTo(0);
    }
  }, [currentSong, playerReady, progress.position]);

  const seekTo = useCallback(
    (seconds) => {
      if (!playerReady) return;

      try {
        TrackPlayer.seekTo(seconds);
      } catch {
        // Ignore a seek while the player is transitioning.
      }
    },
    [playerReady]
  );

  const setVolume = useCallback(
    (value) => {
      const nextVolume = Math.min(1, Math.max(0, value));
      setVolumeState(nextVolume);

      if (playerReady) {
        TrackPlayer.setVolume(nextVolume);
      }
    },
    [playerReady]
  );

  const toggleShuffle = useCallback(() => {
    const nextValue = !shuffleEnabled;
    setShuffleEnabled(nextValue);

    if (playerReady) {
      TrackPlayer.setShuffleEnabled(nextValue);
    }
  }, [playerReady, shuffleEnabled]);

  const cycleRepeatMode = useCallback(() => {
    const nextMode =
      repeatMode === 'off'
        ? 'all'
        : repeatMode === 'all'
          ? 'one'
          : 'off';

    setRepeatModeState(nextMode);

    if (playerReady) {
      TrackPlayer.setRepeatMode(nativeRepeatMode(nextMode));
    }
  }, [playerReady, repeatMode]);

  const importSongs = useCallback(async () => {
    setImporting(true);
    setError(null);

    try {
      const imported = await pickAndImportSongs();
      if (!imported.length) return;

      const merged = [...songs, ...imported].sort((a, b) =>
        a.title.localeCompare(b.title, 'fr', {
          sensitivity: 'base'
        })
      );

      setSongs(merged);
      await saveLibrary(merged);
    } catch (e) {
      setError(
        e?.message ||
        'Impossible d’importer les fichiers MP3.'
      );
    } finally {
      setImporting(false);
    }
  }, [songs]);

  const removeSong = useCallback(
    async (song) => {
      try {
        const updatedSongs = songs.filter(
          (item) => item.id !== song.id
        );

        const updatedPlaylists = playlists.map((playlist) => ({
          ...playlist,
          songIds: playlist.songIds.filter(
            (id) => id !== song.id
          ),
          updatedAt: new Date().toISOString()
        }));

        const queueContainedSong =
          activeQueueIdsRef.current.includes(song.id);

        if (queueContainedSong) {
          const currentId = currentSong?.id || null;
          const wasPlaying = isPlaying;

          const remainingQueueIds =
            activeQueueIdsRef.current.filter(
              (id) => id !== song.id
            );

          const remainingSongs = remainingQueueIds
            .map((id) =>
              updatedSongs.find((item) => item.id === id)
            )
            .filter(Boolean);

          if (!remainingSongs.length) {
            TrackPlayer.pause();
            TrackPlayer.clear();
            activeQueueIdsRef.current = [];
          } else {
            let startIndex = currentId
              ? remainingSongs.findIndex(
                  (item) => item.id === currentId
                )
              : 0;

            if (startIndex < 0) startIndex = 0;

            await setNativeQueue(
              remainingSongs,
              activeQueueName,
              startIndex,
              wasPlaying
            );
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
        setError(
          e?.message ||
          'Impossible de supprimer ce morceau.'
        );
      }
    },
    [
      activeQueueName,
      currentSong,
      isPlaying,
      playlists,
      setNativeQueue,
      songs
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
          (playlist) =>
            playlist.name.toLocaleLowerCase() ===
            cleanedName.toLocaleLowerCase()
        )
      ) {
        setError('Une playlist porte déjà ce nom.');
        return null;
      }

      const now = new Date().toISOString();
      const playlist = {
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}`,
        name: cleanedName,
        songIds: [],
        coverUri: null,
        createdAt: now,
        updatedAt: now
      };

      const updated = [...playlists, playlist].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', {
          sensitivity: 'base'
        })
      );

      setPlaylists(updated);
      await savePlaylists(updated);
      return playlist;
    },
    [playlists]
  );

  const deletePlaylist = useCallback(
    async (playlistId) => {
      const playlist = playlists.find(
        (item) => item.id === playlistId
      );

      const updated = playlists.filter(
        (item) => item.id !== playlistId
      );

      setPlaylists(updated);

      await Promise.all([
        savePlaylists(updated),
        deletePlaylistCover(playlist?.coverUri)
      ]);
    },
    [playlists]
  );

  const updatePlaylistSongs = useCallback(
    async (playlistId, songIds) => {
      const validIds = new Set(
        songs.map((song) => song.id)
      );

      const uniqueIds = [...new Set(songIds)].filter((id) =>
        validIds.has(id)
      );

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
      const playlist = playlists.find(
        (item) => item.id === playlistId
      );

      if (!playlist) return;

      await updatePlaylistSongs(
        playlistId,
        playlist.songIds.filter((id) => id !== songId)
      );
    },
    [playlists, updatePlaylistSongs]
  );

  const choosePlaylistCover = useCallback(
    async (playlistId) => {
      const playlist = playlists.find(
        (item) => item.id === playlistId
      );

      if (!playlist) return false;

      try {
        const coverUri = await pickPlaylistCover(
          playlistId,
          playlist.coverUri
        );

        if (!coverUri) return false;

        const updated = playlists.map((item) =>
          item.id === playlistId
            ? {
                ...item,
                coverUri,
                updatedAt: new Date().toISOString()
              }
            : item
        );

        setPlaylists(updated);
        await savePlaylists(updated);
        return true;
      } catch (e) {
        setError(
          e?.message ||
          'Impossible d’utiliser cette image.'
        );
        return false;
      }
    },
    [playlists]
  );

  const clearPlaylistCover = useCallback(
    async (playlistId) => {
      const playlist = playlists.find(
        (item) => item.id === playlistId
      );

      if (!playlist) return;

      const updated = playlists.map((item) =>
        item.id === playlistId
          ? {
              ...item,
              coverUri: null,
              updatedAt: new Date().toISOString()
            }
          : item
      );

      setPlaylists(updated);

      await Promise.all([
        savePlaylists(updated),
        deletePlaylistCover(playlist.coverUri)
      ]);
    },
    [playlists]
  );

  const songsForPlaylist = useCallback(
    (playlist) =>
      (playlist?.songIds || [])
        .map((id) =>
          songs.find((song) => song.id === id)
        )
        .filter(Boolean),
    [songs]
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
    isPlaying,
    currentTime: progress.position || 0,
    duration: progress.duration || 0,
    buffered: progress.buffered || 0,
    volume,

    shuffleEnabled,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,

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
    deletePlaylist,
    updatePlaylistSongs,
    removeSongFromPlaylist,
    songsForPlaylist,
    choosePlaylistCover,
    clearPlaylistCover
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
    throw new Error(
      'useMusic doit être utilisé dans MusicProvider.'
    );
  }

  return context;
}
