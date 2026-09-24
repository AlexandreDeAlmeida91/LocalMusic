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
            size={100}
            radius={22}
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
                Alert.alert(
                  item.title,
                  selectedPlaylist.name,
                  [
                    {
                      text: 'Retirer de la playlist',
                      style: 'destructive',
                      onPress: () =>
                        removeSongFromPlaylist(selectedPlaylist.id, item.id)
                    },
                    { text: 'Annuler', style: 'cancel' }
                  ]
                )
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
          <Text style={styles.eyebrow}>LOCAL · HORS LIGNE</Text>
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
              onMore={() => confirmDeleteSong(item)}
              onLongPress={() => confirmDeleteSong(item)}
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
          <Text style={styles.eyebrow}>TES AMBIANCES</Text>
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
      <StatusBar barStyle="dark-content" />

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
        <StatusBar barStyle="dark-content" />
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
    backgroundColor: '#fff'
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#77777f'
  },
  heading: {
    marginTop: 2,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    color: '#111'
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addButtonPressed: {
    opacity: 0.55
  },
  addButtonText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '500',
    marginTop: -2
  },
  segmented: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 3,
    borderRadius: 11,
    backgroundColor: '#efeff4',
    flexDirection: 'row'
  },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segmentActive: {
    backgroundColor: '#fff'
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#77777f'
  },
  segmentTextActive: {
    color: '#111'
  },
  list: {
    paddingBottom: 10
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ededf1',
    marginLeft: 82
  },
  fullSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ededf1'
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
    color: '#777'
  },
  emptyIcon: {
    fontSize: 64,
    color: '#4b35d1'
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '800'
  },
  emptyText: {
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    color: '#717178'
  },
  importButton: {
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: '#4b35d1',
    paddingHorizontal: 20,
    paddingVertical: 13
  },
  importButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  importOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 92,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(248,248,251,0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8d8de',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10
  },
  importOverlayText: {
    color: '#444',
    fontWeight: '600'
  },
  playlistList: {
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  playlistRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  pressed: {
    opacity: 0.58
  },
  playlistRowText: {
    flex: 1
  },
  playlistRowTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111'
  },
  playlistRowCount: {
    marginTop: 4,
    fontSize: 13,
    color: '#7a7a82'
  },
  chevron: {
    fontSize: 28,
    color: '#9a9aa1'
  },
  detailHeader: {
    minHeight: 52,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    minWidth: 100,
    height: 44,
    justifyContent: 'center'
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4b35d1'
  },
  optionsButton: {
    width: 50,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionsText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#444'
  },
  playlistHero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18
  },
  playlistHeroText: {
    flex: 1
  },
  playlistTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    color: '#111'
  },
  playlistCount: {
    marginTop: 7,
    fontSize: 14,
    color: '#7a7a82'
  },
  coverHint: {
    marginTop: 7,
    fontSize: 11,
    color: '#9a9aa1'
  },
  playlistActions: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    gap: 10
  },
  playAllButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: '#4b35d1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  playAllText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  disabledButton: {
    opacity: 0.35
  },
  manageButton: {
    minWidth: 118,
    minHeight: 46,
    paddingHorizontal: 15,
    borderRadius: 13,
    backgroundColor: '#efeff4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#222'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    backgroundColor: '#fff',
    padding: 20
  },
  dialogTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111'
  },
  dialogHint: {
    marginTop: 5,
    fontSize: 13,
    color: '#77777f'
  },
  input: {
    marginTop: 18,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f1f5',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111'
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
    color: '#666'
  },
  primarySmallButton: {
    minHeight: 42,
    borderRadius: 11,
    paddingHorizontal: 18,
    backgroundColor: '#4b35d1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  primarySmallButtonLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800'
  },
  modalPage: {
    flex: 1,
    backgroundColor: '#fff'
  },
  modalHeader: {
    minHeight: 58,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e3e8',
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
    fontWeight: '800',
    color: '#111'
  },
  modalSubtitle: {
    marginTop: 2,
    maxWidth: 220,
    fontSize: 11,
    color: '#85858c'
  },
  modalCancel: {
    fontSize: 15,
    color: '#555'
  },
  modalSave: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4b35d1'
  },
  selectSongRow: {
    minHeight: 66,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#aaaab2',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkBoxActive: {
    backgroundColor: '#4b35d1',
    borderColor: '#4b35d1'
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
    fontWeight: '700',
    color: '#111'
  },
  selectSongArtist: {
    marginTop: 3,
    fontSize: 13,
    color: '#77777f'
  }
});
