import usePreference from '../hooks/usePreference';
import {cleanupStartup} from '../services/cacheStorage';
import {validTiming} from '../services/lyricsTiming';
import * as FileSystem from 'expo-file-system/legacy';
import { findOnlineLyrics } from '../services/cachedLyrics';
import { ensureDirectories, LYRICS_DIR } from '../services/storage';
import { findExistingImport } from '../services/importDedup';
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
  repairStoredSong,
  deleteSongFile,
  commitDownloadedSong,
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
  configureRemoteCommands,
  nativeRepeatMode,
  songToMediaItem,
  TrackPlayer
} from '../services/player';
import {
  deleteLyrics,
  pickAndStoreLyrics
} from '../services/lyrics';
import {
  deleteCustomSongArtwork,
  pickCustomSongArtwork
} from '../services/songArtwork';
import { resolveLocalPath } from '../services/storage';

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const songsRef = useRef(songs);
  songsRef.current = songs;
  const [playlists, setPlaylists] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [importing, setImporting] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [activeQueueName, setActiveQueueName] = useState('Bibliothèque');
  const [shuffleEnabled, setShuffleEnabled] = usePreference('shuffleEnabled', false);
  const [repeatMode, setRepeatModeState] = usePreference('repeatMode', 'off');
  const [playerVisible, setPlayerVisible] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState(null);

  const activeQueueIdsRef = useRef([]);
  const repairingRef = useRef(false);

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
        await cleanupStartup();
        await ensurePlayer();
        setPlayerReady(true);

        const [storedSongs, storedPlaylists] = await Promise.all([
          loadLibrary(),
          loadPlaylists()
        ]);

        setSongs(storedSongs);

        // Never destructively rewrite playlist membership during app startup.
        // If storage is temporarily unavailable or a song needs migration,
        // preserving songIds lets the relationship recover on the next launch.
        setPlaylists(storedPlaylists);
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

      // Re-apply commands right before and after loading the queue.
      // This is important on iOS: commands configured while the queue is empty
      // can remain visible but disabled on the lock screen.
      configureRemoteCommands();

      TrackPlayer.setMediaItems(
        validSongs.map(songToMediaItem),
        safeIndex
      );

      TrackPlayer.setShuffleEnabled(shuffleEnabled);
      TrackPlayer.setRepeatMode(nativeRepeatMode(repeatMode));
      TrackPlayer.setVolume(volume);

      // Refresh iOS MPRemoteCommandCenter now that there is an active item
      // and a concrete queue, so Previous/Next/Seek become enabled.
      configureRemoteCommands();

      activeQueueIdsRef.current = validSongs.map((song) => song.id);
      setActiveQueueName(queueName || 'Bibliothèque');

      if (autoPlay) {
        TrackPlayer.play();

        // One final refresh after playback becomes active. This is harmless
        // on Android and avoids stale disabled states on iOS.
        configureRemoteCommands();
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

  const findImportedSong = useCallback(candidate => findExistingImport(songsRef.current, candidate), []);

  const acceptDownloadedSong = useCallback(async (download) => {
    const result = await commitDownloadedSong(download, songsRef.current);
    songsRef.current = result.songs;
    setSongs(result.songs);
    return result;
  }, []);

  const lyricsJobs = useRef(new Set());
  const attachOnlineLyrics = useCallback(async (songId, result) => {
    let song = songsRef.current.find(s => s.id === songId);
    if (!song || song.lyricsUri || song.lyricsPath) return 'Paroles déjà présentes';
    let uri;
    try {
      if (result.text) {
        await ensureDirectories([LYRICS_DIR]);
        uri = resolveLocalPath(`Lyrics/${songId}-auto-${Date.now()}.txt`);
        await FileSystem.writeAsStringAsync(uri, result.text);
      }
      song = songsRef.current.find(s => s.id === songId);
      if (!song || song.lyricsUri || song.lyricsPath) {
        if (uri) await FileSystem.deleteAsync(uri, {idempotent:true});
        return 'Paroles déjà présentes ou morceau retiré';
      }
      const updated = songsRef.current.map(s => s.id === songId ? {...s,
        lyricsUri: uri || null, lyricsTiming: validTiming(result.timing, result.text) ? result.timing : null, lyricsStatus: result.status,
        lyricsSource: result.source || null, lyricsSourceUrl: result.sourceUrl || null,
        lyricsUpdatedAt: new Date().toISOString()} : s);
      const previous = songsRef.current;
      songsRef.current = updated;
      setSongs(updated);
      try { await saveLibrary(updated); }
      catch (e) {
        if (songsRef.current === updated) { songsRef.current = previous; setSongs(previous); }
        throw e;
      }
      return result.status;
    } catch (e) {
      if (uri) await FileSystem.deleteAsync(uri, {idempotent:true}).catch(() => {});
      return 'Enregistrement des paroles impossible';
    }
  }, []);

  const saveChosenLyrics = useCallback(async (song, result) => {
    const text = String(result.text || '').trim();
    if (!text || text.length > 60000) throw new Error('Ajoute un texte de 1 à 60 000 caractères.');
    const before = songsRef.current.find(s => s.id === song.id);
    if (!before) throw new Error('Ce morceau a été supprimé.');
    const uri = resolveLocalPath(`Lyrics/${song.id}-manual-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
    try {
      await ensureDirectories([LYRICS_DIR]);
      await FileSystem.writeAsStringAsync(uri, text);
      const latest = songsRef.current.find(s => s.id === song.id);
      if (!latest || latest.lyricsUri !== before.lyricsUri || latest.lyricsUpdatedAt !== before.lyricsUpdatedAt)
        throw new Error('Les paroles ont changé entre-temps. Rouvre ce morceau.');
      const previous = songsRef.current;
      const updated = previous.map(s => s.id === song.id ? {...s, lyricsUri: uri, lyricsPath: null, lyricsTiming: validTiming(result.timing, text) ? result.timing : null,
        lyricsStatus: 'Paroles disponibles', lyricsSource: result.source || 'Texte personnel',
        lyricsSourceUrl: result.sourceUrl || null, lyricsUpdatedAt: new Date().toISOString()} : s);
      songsRef.current = updated; setSongs(updated);
      try { await saveLibrary(updated); }
      catch (e) { if (songsRef.current === updated) { songsRef.current = previous; setSongs(previous); } throw e; }
    } catch (e) {
      await FileSystem.deleteAsync(uri, {idempotent:true}).catch(() => {});
      throw e;
    }
    await deleteLyrics(before.lyricsUri || before.lyricsPath);
    return true;
  }, []);

  const saveLyricsTiming = useCallback(async (songId, timing) => {
    if (!validTiming(timing, timing.text)) throw new Error('Les repères de synchronisation sont incomplets ou incohérents.');
    const song = songsRef.current.find(s => s.id === songId);
    if (!song?.lyricsUri) throw new Error('Les paroles ne sont plus disponibles.');
    const raw = await FileSystem.readAsStringAsync(song.lyricsUri);
    const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (text !== timing.text) throw new Error('Les paroles ont changé. Recommence la synchronisation.');
    const latest = songsRef.current.find(s => s.id === songId);
    if (!latest || latest.lyricsUri !== song.lyricsUri) throw new Error('Le morceau a changé.');
    const previous = songsRef.current;
    const updated = previous.map(s => s.id === songId ? {...s, lyricsTiming: timing} : s);
    songsRef.current = updated; setSongs(updated);
    try { await saveLibrary(updated); }
    catch (e) { if (songsRef.current === updated) {songsRef.current = previous; setSongs(previous);} throw e; }
  }, []);

  const searchSongLyrics = useCallback(async (song) => {
    if (lyricsJobs.current.has(song.id)) return;
    lyricsJobs.current.add(song.id);
    try {
      const result = await findOnlineLyrics(song, undefined, true);
      const status = await attachOnlineLyrics(song.id, result);
      setError(status);
    } finally { lyricsJobs.current.delete(song.id); }
  }, [attachOnlineLyrics]);

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

  const repairAudio = useCallback(async (song) => {
    if (importing || repairingRef.current) throw new Error('Attends la fin de l’import ou de la réparation en cours.');
    repairingRef.current = true;
    setImporting(true);
    try {
      const result = await repairStoredSong(song, () => songsRef.current);
      songsRef.current = result.songs;
      setSongs(result.songs);
      if (result.changed && currentSong?.id === song.id) {
        // Reload the new URL so AVPlayer cannot retain the old duration.
        const queue = activeQueueIdsRef.current.map(id => result.songs.find(s => s.id === id)).filter(Boolean);
        await setNativeQueue(queue, activeQueueName, queue.findIndex(s => s.id === song.id), isPlaying);
      }
      return result.changed ? 'Morceau réparé. L’original est conservé.' : result.reason;
    } finally { repairingRef.current = false; setImporting(false); }
  }, [importing, currentSong, activeQueueName, isPlaying, setNativeQueue]);

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

  const addOrReplaceLyrics = useCallback(async (song) => {
    const temporaryId = song.id + '-import-' + Date.now();
    const uri = await pickAndStoreLyrics(temporaryId);
    if (!uri) return false;
    try {
      const text = await FileSystem.readAsStringAsync(uri);
      return await saveChosenLyrics(song, {text, source:'Fichier TXT'});
    } finally { await deleteLyrics(uri); }
  }, [saveChosenLyrics]);

  const removeLyrics = useCallback(
    async (song) => {
      try {
        const updated = songs.map((item) =>
          item.id === song.id
            ? {
                ...item,
                lyricsUri: null,
                lyricsTiming: null,
                lyricsPath: null,
                lyricsSource: null,
                lyricsSourceUrl: null,
                lyricsStatus: null,
                lyricsUpdatedAt: null
              }
            : item
        );

        setSongs(updated);

        await Promise.all([
          saveLibrary(updated),
          deleteLyrics(song.lyricsUri)
        ]);

        return true;
      } catch (e) {
        setError(
          e?.message ||
          'Impossible de supprimer les paroles.'
        );
        return false;
      }
    },
    [songs]
  );

  // Refresh Now Playing and every matching queued item in-place.
  // updateMetadata preserves the playback position and keeps remote
  // Play/Pause/Skip/Seek controls working while a cover changes.
  const updateNativeArtwork = useCallback((songId, artworkUri) => {
    if (!playerReady) return;

    try {
      const queue = TrackPlayer.getQueue();
      queue.forEach((item, index) => {
        if (
          item?.mediaId === songId ||
          item?.extras?.localMusicSongId === songId
        ) {
          TrackPlayer.updateMetadata(index, {
            artworkUrl: artworkUri || ''
          });
        }
      });
    } catch (e) {
      // A failed metadata refresh must never reset or interrupt playback.
      // The selected cover remains saved and will load with the next queue.
      console.warn('Peak Music: artwork metadata refresh failed', e);
    }
  }, [playerReady]);

  const changeSongArtwork = useCallback(async (song, source) => {
    let newPath = null;
    try {
      newPath = await pickCustomSongArtwork(song.id, source);
      if (!newPath) return false;

      // Persist first. Delete the old custom file only after a safe save.
      const artworkUri = resolveLocalPath(newPath);
      const updated = songs.map((item) =>
        item.id === song.id
          ? {
              ...item,
              customArtworkPath: newPath,
              artworkUri,
              artworkUpdatedAt: new Date().toISOString()
            }
          : item
      );
      await saveLibrary(updated);
      setSongs(updated);
      updateNativeArtwork(song.id, artworkUri);
      await deleteCustomSongArtwork(song.customArtworkPath);
      return true;
    } catch (e) {
      // A failed import should not leak a newly created custom file.
      if (newPath) await deleteCustomSongArtwork(newPath);
      setError(e?.message || 'Impossible de changer la pochette.');
      return false;
    }
  }, [songs, updateNativeArtwork]);

  const removeSongArtwork = useCallback(async (song) => {
    if (!song.customArtworkPath) return false;

    try {
      // Restore embedded ID3 artwork, or the default placeholder.
      const artworkUri = song.artworkPath
        ? resolveLocalPath(song.artworkPath)
        : null;
      const updated = songs.map((item) =>
        item.id === song.id
          ? {
              ...item,
              customArtworkPath: null,
              artworkUri,
              artworkUpdatedAt: new Date().toISOString()
            }
          : item
      );
      await saveLibrary(updated);
      setSongs(updated);
      updateNativeArtwork(song.id, artworkUri);
      await deleteCustomSongArtwork(song.customArtworkPath);
      return true;
    } catch (e) {
      setError(e?.message || 'Impossible de retirer la pochette.');
      return false;
    }
  }, [songs, updateNativeArtwork]);

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

  const songsById = useMemo(() => new Map(songs.map(song => [song.id, song])), [songs]);
  const songsForPlaylist = useCallback(
    (playlist) =>
      (playlist?.songIds || [])
        .map((id) =>
          songsById.get(id)
        )
        .filter(Boolean),
    [songsById]
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
    acceptDownloadedSong,
    findImportedSong,
    repairAudio,
    removeSong,
    attachOnlineLyrics,
    saveChosenLyrics,
    saveLyricsTiming,
    searchSongLyrics,
    addOrReplaceLyrics,
    removeLyrics,
    changeSongArtwork,
    removeSongArtwork,
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
