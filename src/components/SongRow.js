import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Artwork from './Artwork';
import { useMusic } from '../context/MusicContext';

export default function SongRow({
  song,
  queueSongs,
  queueName = 'Bibliothèque',
  onMore,
  onLongPress
}) {
  const {
    currentSong,
    isPlaying,
    playSong
  } = useMusic();

  const active = currentSong?.id === song.id;

  return (
    <Pressable
      onPress={() => playSong(song, queueSongs, false, queueName)}
      onLongPress={onLongPress}
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

      {active && isPlaying && (
        <Text style={[styles.indicator, styles.activeText]}>≋</Text>
      )}

      {onMore ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onMore();
          }}
          hitSlop={10}
          style={styles.moreButton}
        >
          <Text style={styles.moreText}>•••</Text>
        </Pressable>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
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
    width: 20,
    textAlign: 'center',
    fontSize: 24
  },
  activeText: {
    color: '#4b35d1'
  },
  moreButton: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  moreText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#686870'
  },
  chevron: {
    width: 22,
    textAlign: 'center',
    fontSize: 26,
    color: '#8e8e93'
  }
});
