import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { MusicProvider, useMusic } from './src/context/MusicContext';
import MiniPlayer from './src/components/MiniPlayer';
import PlayerModal from './src/components/PlayerModal';
import SongRow from './src/components/SongRow';
import PlaybackModeBar from './src/components/PlaybackModeBar';
import PlaylistArtwork from './src/components/PlaylistArtwork';
import AmbientBackground from './src/components/AmbientBackground';
import { ensurePlayer } from './src/services/player';

function SegmentedControl({ value, onChange }) {
  return (
    <View style={styles.segmented}>
      <Pressable
        onPress={() => onChange('songs')}
        style={[styles.segment, value === 'songs' && styles.segmentActive]}
      >
        <Text style={[styles.segmentText, value === 'songs' && styles.segmentTextActive]}>
          Morceaux
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onChange('playlists')}
        style={[styles.segment, value === 'playlists' && styles.segmentActive]}
      >
        <Text
          style={[
            styles.segmentText,
            value === 'playlists' && styles.segmentTextActive
          ]}
        >
          Playlists
        </Text>
      </Pressable>
    </View>
  );
}

function CreatePlaylistModal({ visible, onClose, onCreate }) {
  const [name, setName] = useState('');

  React.useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  const submit = async () => {
    const created = await onCreate(name);
    if (created) onClose(created);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onClose(null)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Nouvelle playlist</Text>
          <Text style={styles.dialogHint}>
            Exemple : Rap, Rock, Salle, Chill…
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nom de la playlist"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
            style={styles.input}
          />

          <View style={styles.dialogActions}>
            <Pressable onPress={() => onClose(null)} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>Annuler</Text>
            </Pressable>

            <Pressable onPress={submit} style={styles.primarySmallButton}>
              <Text style={styles.primarySmallButtonLabel}>Créer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ManageSongsModal({ visible, playlist, songs, onClose, onSave }) {
  const [selectedIds, setSelectedIds] = useState([]);

  React.useEffect(() => {
    if (visible && playlist) {
      setSelectedIds(playlist.songIds || []);
    }
  }, [playlist, visible]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (songId) => {
    setSelectedIds((current) =>
      current.includes(songId)
        ? current.filter((id) => id !== songId)
        : [...current, songId]
    );
  };

  const save = async () => {
    if (!playlist) return;

    const currentOrder = (playlist.songIds || []).filter((id) => selected.has(id));
    const additions = songs
      .map((song) => song.id)
      .filter((id) => selected.has(id) && !currentOrder.includes(id));

    await onSave(playlist.id, [...currentOrder, ...additions]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalPage}>
        <AmbientBackground />
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.modalHeaderButton}>
            <Text style={styles.modalCancel}>Annuler</Text>
          </Pressable>

          <View style={styles.modalHeaderCenter}>
            <Text style={styles.modalTitle}>Morceaux</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {playlist?.name || ''}
            </Text>
          </View>

          <Pressable onPress={save} style={styles.modalHeaderButton}>
            <Text style={styles.modalSave}>OK</Text>
          </Pressable>
        </View>

        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Aucun morceau</Text>
              <Text style={styles.emptyText}>
                Importe d’abord des MP3 dans ta bibliothèque.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const checked = selected.has(item.id);

            return (
              <Pressable
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [
                  styles.selectSongRow,
                  pressed && styles.pressed
                ]}
              >
                <View style={[styles.checkBox, checked && styles.checkBoxActive]}>
                  {checked && <Text style={styles.checkMark}>✓</Text>}
                </View>

                <View style={styles.selectSongText}>
                  <Text style={styles.selectSongTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.selectSongArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.fullSeparator} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

function LibraryScreen() {
  const {
    songs,
    playlists,
    loadingLibrary,
    importing,
    error,
    clearError,
    importSongs,
    removeSong,
    addOrReplaceLyrics,
    removeLyrics,
    createPlaylist,
    deletePlaylist,
    updatePlaylistSongs,
    removeSongFromPlaylist,
    songsForPlaylist,
    playQueue,
    choosePlaylistCover,
    clearPlaylistCover
  } = useMusic();

  const [tab, setTab] = useState('songs');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [manageSongsVisible, setManageSongsVisible] = useState(false);

  const selectedPlaylist = playlists.find(
    (playlist) => playlist.id === selectedPlaylistId
  );

  const selectedPlaylistSongs = selectedPlaylist
    ? songsForPlaylist(selectedPlaylist)
    : [];

  React.useEffect(() => {
    if (selectedPlaylistId && !selectedPlaylist) {
      setSelectedPlaylistId(null);
    }
  }, [selectedPlaylist, selectedPlaylistId]);

  React.useEffect(() => {
    if (error) {
      Alert.alert('Erreur', error, [
        { text: 'OK', onPress: clearError }
      ]);
    }
  }, [clearError, error]);

  const confirmDeleteSong = (song) => {
    Alert.alert(
      'Supprimer le morceau ?',
      `« ${song.title} » sera supprimé de LocalMusic et de toutes les playlists.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => removeSong(song)
        }
      ]
    );
  };

  const openSongOptions = (song, playlist = null) => {
    const actions = [
      {
        text: song.lyricsUri
          ? 'Remplacer les paroles'
          : 'Ajouter des paroles',
        onPress: () => addOrReplaceLyrics(song)
      }
    ];

    if (song.lyricsUri) {
      actions.push({
        text: 'Supprimer les paroles',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Supprimer les paroles ?',
            `Le fichier de paroles associé à « ${song.title} » sera supprimé.`,
            [
              { text: 'Annuler', style: 'cancel' },
              {
                text: 'Supprimer',
                style: 'destructive',
                onPress: () => removeLyrics(song)
              }
            ]
          );
        }
      });
    }

    if (playlist) {
      actions.push({
        text: 'Retirer de la playlist',
        style: 'destructive',
        onPress: () =>
          removeSongFromPlaylist(playlist.id, song.id)
      });
    }

    actions.push({
      text: 'Supprimer le morceau',
      style: 'destructive',
      onPress: () => confirmDeleteSong(song)
    });

    actions.push({
      text: 'Annuler',
      style: 'cancel'
    });

    Alert.alert(
      song.title,
      playlist?.name || 'Gérer ce morceau',
      actions
    );
  };

  const playlistOptions = () => {
    if (!selectedPlaylist) return;

    const imageActions = [
      {
        text: selectedPlaylist.coverUri ? 'Changer l’image' : 'Choisir une image',
        onPress: () => choosePlaylistCover(selectedPlaylist.id)
      }
    ];

    if (selectedPlaylist.coverUri) {
      imageActions.push({
        text: 'Retirer l’image',
        style: 'destructive',
        onPress: () => clearPlaylistCover(selectedPlaylist.id)
      });
    }

    Alert.alert(
      selectedPlaylist.name,
      'Personnalise ta playlist.',
      [
        ...imageActions,
        {
          text: 'Supprimer la playlist',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Supprimer cette playlist ?',
              'Les MP3 resteront dans ta bibliothèque.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer',
                  style: 'destructive',
                  onPress: async () => {
                    await deletePlaylist(selectedPlaylist.id);
                    setSelectedPlaylistId(null);
                  }
                }
              ]
            );
          }
        },
        { text: 'Annuler', style: 'cancel' }
      ]
    );
  };

  const renderPlaylistDetail = () => (
    <>
      <View style={styles.detailHeader}>
        <Pressable
          onPress={() => setSelectedPlaylistId(null)}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Playlists</Text>
        </Pressable>

        <Pressable onPress={playlistOptions} style={styles.optionsButton}>
          <Text style={styles.optionsText}>•••</Text>
        </Pressable>
      </View>

      <View style={styles.playlistHero}>
        <Pressable onPress={() => choosePlaylistCover(selectedPlaylist.id)}>
          <PlaylistArtwork
            uri={selectedPlaylist.coverUri}
            size={118}
            radius={24}
          />
        </Pressable>

        <View style={styles.playlistHeroText}>
          <Text style={styles.playlistTitle} numberOfLines={2}>
            {selectedPlaylist.name}
          </Text>
          <Text style={styles.playlistCount}>
            {selectedPlaylistSongs.length} morceau
            {selectedPlaylistSongs.length > 1 ? 'x' : ''}
          </Text>
          <Text style={styles.coverHint}>
            Touche l’image pour la personnaliser
          </Text>
        </View>
      </View>

      <View style={styles.playlistActions}>
        <Pressable
          onPress={() =>
            playQueue(selectedPlaylistSongs, selectedPlaylist.name)
          }
          disabled={!selectedPlaylistSongs.length}
          style={[
            styles.playAllButton,
            !selectedPlaylistSongs.length && styles.disabledButton
          ]}
        >
          <Text style={styles.playAllText}>▶ Tout lire</Text>
        </Pressable>

        <Pressable
          onPress={() => setManageSongsVisible(true)}
          style={styles.manageButton}
        >
          <Text style={styles.manageButtonText}>+ Morceaux</Text>
        </Pressable>
      </View>

      <PlaybackModeBar />

      {selectedPlaylistSongs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>♬</Text>
          <Text style={styles.emptyTitle}>Playlist vide</Text>
          <Text style={styles.emptyText}>
            Ajoute les MP3 qui correspondent à ce style ou à cette ambiance.
          </Text>
          <Pressable
            onPress={() => setManageSongsVisible(true)}
            style={styles.importButton}
          >
            <Text style={styles.importButtonText}>Choisir des morceaux</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={selectedPlaylistSongs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SongRow
              song={item}
              queueSongs={selectedPlaylistSongs}
              queueName={selectedPlaylist.name}
              onMore={() =>
                openSongOptions(item, selectedPlaylist)
              }
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </>
  );

  const renderSongs = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Ma musique</Text>
        </View>

        <Pressable
          onPress={importSongs}
          disabled={importing}
          style={({ pressed }) => [
            styles.addButton,
            (pressed || importing) && styles.addButtonPressed
          ]}
        >
          <Text style={styles.addButtonText}>
            {importing ? '…' : '+'}
          </Text>
        </Pressable>
      </View>

      <SegmentedControl value={tab} onChange={setTab} />
      <PlaybackModeBar />

      {loadingLibrary ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : songs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>♫</Text>
          <Text style={styles.emptyTitle}>Aucune musique</Text>
          <Text style={styles.emptyText}>
            Importe tes fichiers MP3 depuis l’app Fichiers de ton iPhone.
          </Text>

          <Pressable
            onPress={importSongs}
            disabled={importing}
            style={styles.importButton}
          >
            <Text style={styles.importButtonText}>
              {importing ? 'Importation…' : 'Importer des MP3'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SongRow
              song={item}
              queueSongs={songs}
              queueName="Bibliothèque"
              onMore={() => openSongOptions(item)}
              onLongPress={() => openSongOptions(item)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </>
  );

  const renderPlaylists = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Playlists</Text>
        </View>

        <Pressable
          onPress={() => setCreateVisible(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      <SegmentedControl value={tab} onChange={setTab} />

      {playlists.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>▤</Text>
          <Text style={styles.emptyTitle}>Aucune playlist</Text>
          <Text style={styles.emptyText}>
            Classe tes MP3 selon ton style ou ton envie d’écoute.
          </Text>

          <Pressable
            onPress={() => setCreateVisible(true)}
            style={styles.importButton}
          >
            <Text style={styles.importButtonText}>Créer une playlist</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.playlistList}
          renderItem={({ item }) => {
            const count = songsForPlaylist(item).length;

            return (
              <Pressable
                onPress={() => setSelectedPlaylistId(item.id)}
                style={({ pressed }) => [
                  styles.playlistRow,
                  pressed && styles.pressed
                ]}
              >
                <PlaylistArtwork uri={item.coverUri} />

                <View style={styles.playlistRowText}>
                  <Text style={styles.playlistRowTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.playlistRowCount}>
                    {count} morceau{count > 1 ? 'x' : ''}
                  </Text>
                </View>

                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.fullSeparator} />}
        />
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AmbientBackground />

      {selectedPlaylist
        ? renderPlaylistDetail()
        : tab === 'songs'
          ? renderSongs()
          : renderPlaylists()}

      {importing && songs.length > 0 && (
        <View style={styles.importOverlay}>
          <ActivityIndicator />
          <Text style={styles.importOverlayText}>Importation des MP3…</Text>
        </View>
      )}

      <MiniPlayer />
      <PlayerModal />

      <CreatePlaylistModal
        visible={createVisible}
        onCreate={createPlaylist}
        onClose={(created) => {
          setCreateVisible(false);
          if (created?.id) {
            setTab('playlists');
            setSelectedPlaylistId(created.id);
          }
        }}
      />

      <ManageSongsModal
        visible={manageSongsVisible}
        playlist={selectedPlaylist}
        songs={songs}
        onClose={() => setManageSongsVisible(false)}
        onSave={updatePlaylistSongs}
      />
    </SafeAreaView>
  );
}

export default function App() {
  const [ready, setReady] = React.useState(false);
  const [bootError, setBootError] = React.useState(null);

  React.useEffect(() => {
    ensurePlayer()
      .then(() => setReady(true))
      .catch((error) => {
        setBootError(
          error?.message ||
          'Impossible d’initialiser le lecteur audio.'
        );
      });
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <AmbientBackground stronger />
        <View style={styles.center}>
          {bootError ? (
            <>
              <Text style={styles.emptyTitle}>Erreur audio</Text>
              <Text style={styles.emptyText}>{bootError}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>
                Initialisation du lecteur…
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <MusicProvider>
      <LibraryScreen />
    </MusicProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#070913'
  },
  header: {
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#9d97bb'
  },
  heading: {
    marginTop: 2,
    fontSize: 39,
    lineHeight: 45,
    fontWeight: '900',
    letterSpacing: -1.1,
    color: '#ffffff'
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6c4eff',
    borderWidth: 1,
    borderColor: '#9c87ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7254ff',
    shadowOpacity: 0.48,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 }
  },
  addButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }]
  },
  addButtonText: {
    color: '#fff',
    fontSize: 31,
    lineHeight: 33,
    fontWeight: '500',
    marginTop: -2
  },
  segmented: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 4,
    minHeight: 49,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 126, 255, 0.22)',
    backgroundColor: 'rgba(25, 27, 48, 0.90)',
    flexDirection: 'row'
  },
  segment: {
    flex: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentActive: {
    backgroundColor: 'rgba(101, 75, 221, 0.66)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(174, 154, 255, 0.62)',
    shadowColor: '#7558ff',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#aaa5c4'
  },
  segmentTextActive: {
    color: '#ffffff'
  },
  list: {
    paddingTop: 1,
    paddingBottom: 12
  },
  separator: {
    height: 9,
    backgroundColor: 'transparent'
  },
  fullSeparator: {
    height: 10,
    backgroundColor: 'transparent'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
    paddingVertical: 24
  },
  loadingText: {
    marginTop: 12,
    color: '#aaa5c1'
  },
  emptyIcon: {
    fontSize: 64,
    color: '#8c70ff'
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff'
  },
  emptyText: {
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    color: '#aaa5c1'
  },
  importButton: {
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: '#6448ee',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9982ff',
    paddingHorizontal: 22,
    paddingVertical: 14,
    shadowColor: '#6749f1',
    shadowOpacity: 0.28,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 6 }
  },
  importButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900'
  },
  importOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 92,
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: 'rgba(27, 28, 50, 0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(151, 128, 255, 0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10
  },
  importOverlayText: {
    color: '#f0edff',
    fontWeight: '700'
  },
  playlistList: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 14
  },
  playlistRow: {
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 19,
    backgroundColor: 'rgba(23, 25, 44, 0.90)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 126, 255, 0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 }
  },
  pressed: {
    opacity: 0.66,
    transform: [{ scale: 0.992 }]
  },
  playlistRowText: {
    flex: 1
  },
  playlistRowTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff'
  },
  playlistRowCount: {
    marginTop: 5,
    fontSize: 13,
    color: '#aaa5c1'
  },
  chevron: {
    fontSize: 30,
    color: '#9f95d4'
  },
  detailHeader: {
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    minWidth: 108,
    height: 44,
    justifyContent: 'center'
  },
  backText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9a83ff'
  },
  optionsButton: {
    width: 50,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionsText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#c0b9dc'
  },
  playlistHero: {
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 16,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(17, 19, 34, 0.54)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(149, 127, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18
  },
  playlistHeroText: {
    flex: 1
  },
  playlistTitle: {
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.7,
    color: '#ffffff'
  },
  playlistCount: {
    marginTop: 8,
    fontSize: 14,
    color: '#b1acc5'
  },
  coverHint: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    color: '#7f7998'
  },
  playlistActions: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    gap: 10
  },
  playAllButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#6549ef',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#9b84ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6d4fff',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }
  },
  playAllText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900'
  },
  disabledButton: {
    opacity: 0.35
  },
  manageButton: {
    minWidth: 118,
    minHeight: 50,
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(25, 27, 47, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(147, 126, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#f2efff'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#151727',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(154, 131, 255, 0.36)',
    padding: 20,
    shadowColor: '#6749f1',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }
  },
  dialogTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff'
  },
  dialogHint: {
    marginTop: 5,
    fontSize: 13,
    color: '#aaa5c1'
  },
  input: {
    marginTop: 18,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#202237',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(153, 130, 255, 0.22)',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#ffffff'
  },
  dialogActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  textButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b4afc6'
  },
  primarySmallButton: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 18,
    backgroundColor: '#6549ef',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primarySmallButtonLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900'
  },
  modalPage: {
    flex: 1,
    backgroundColor: '#090b15'
  },
  modalHeader: {
    minHeight: 60,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(152, 130, 255, 0.18)',
    backgroundColor: '#0a0c17',
    flexDirection: 'row',
    alignItems: 'center'
  },
  modalHeaderButton: {
    width: 78,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff'
  },
  modalSubtitle: {
    marginTop: 2,
    maxWidth: 220,
    fontSize: 11,
    color: '#8e88a9'
  },
  modalCancel: {
    fontSize: 15,
    color: '#b3aec5'
  },
  modalSave: {
    fontSize: 15,
    fontWeight: '900',
    color: '#9a83ff'
  },
  selectSongRow: {
    minHeight: 68,
    marginHorizontal: 14,
    marginVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(25, 27, 47, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#77718f',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkBoxActive: {
    backgroundColor: '#6549ef',
    borderColor: '#9b84ff'
  },
  checkMark: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900'
  },
  selectSongText: {
    flex: 1
  },
  selectSongTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff'
  },
  selectSongArtist: {
    marginTop: 3,
    fontSize: 13,
    color: '#aaa5c1'
  }
});
