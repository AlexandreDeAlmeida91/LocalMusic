import React from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Artwork from './Artwork';
import { useMusic } from '../context/MusicContext';

export default function SongRow({ song }) {
  const {
    currentSong,
    isPlaying,
    playSong,
    removeSong
  } = useMusic();

  const active = currentSong?.id === song.id;

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer le morceau ?',
      `« ${song.title} » sera supprimé du stockage de l’application.`,
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

  return (
    <Pressable
      onPress={() => playSong(song)}
      onLongPress={confirmDelete}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed
      ]}
    >
      <Artwork uri={song.artworkUri} />

      <View style={styles.texts}>
        <Text
          style={[styles.title, active && styles.activeText]}
          numberOfLines={1}
        >
          {song.title}
        </Text>

        <Text style={styles.artist} numberOfLines={1}>
          {song.artist}
        </Text>
      </View>

      <Text style={[styles.indicator, active && styles.activeText]}>
        {active && isPlaying ? '≋' : '›'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12
  },
  pressed: {
    opacity: 0.6
  },
  texts: {
    flex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111'
  },
  artist: {
    marginTop: 4,
    fontSize: 14,
    color: '#6f6f76'
  },
  indicator: {
    width: 28,
    textAlign: 'center',
    fontSize: 25,
    color: '#8e8e93'
  },
  activeText: {
    color: '#4b35d1'
  }
});
