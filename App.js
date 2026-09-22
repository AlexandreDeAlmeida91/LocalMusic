import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { MusicProvider, useMusic } from './src/context/MusicContext';
import MiniPlayer from './src/components/MiniPlayer';
import PlayerModal from './src/components/PlayerModal';
import SongRow from './src/components/SongRow';

function LibraryScreen() {
  const {
    songs,
    loadingLibrary,
    importing,
    error,
    clearError,
    importSongs
  } = useMusic();

  React.useEffect(() => {
    if (error) {
      Alert.alert('Erreur', error, [
        { text: 'OK', onPress: clearError }
      ]);
    }
  }, [clearError, error]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

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
          renderItem={({ item }) => <SongRow song={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {importing && songs.length > 0 && (
        <View style={styles.importOverlay}>
          <ActivityIndicator />
          <Text style={styles.importOverlayText}>Importation des MP3…</Text>
        </View>
      )}

      <MiniPlayer />
      <PlayerModal />
    </SafeAreaView>
  );
}

export default function App() {
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
    paddingBottom: 12,
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
  list: {
    paddingBottom: 10
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ededf1',
    marginLeft: 82
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35
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
    maxWidth: 300,
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
    gap: 10
  },
  importOverlayText: {
    color: '#444',
    fontWeight: '600'
  }
});
