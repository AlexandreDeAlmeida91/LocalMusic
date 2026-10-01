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
        active && styles.activeRow,
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
        <Text style={styles.indicator}>≋</Text>
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
    minHeight: 76,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(23, 25, 44, 0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 126, 255, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.20,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 }
  },
  activeRow: {
    borderColor: 'rgba(139, 112, 255, 0.46)',
    backgroundColor: 'rgba(34, 30, 67, 0.92)'
  },
  pressed: {
    opacity: 0.70,
    transform: [{ scale: 0.992 }]
  },
  texts: {
    flex: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f7f5ff'
  },
  artist: {
    marginTop: 4,
    fontSize: 13,
    color: '#aaa7be'
  },
  indicator: {
    width: 18,
    textAlign: 'center',
    fontSize: 23,
    color: '#9a83ff'
  },
  activeText: {
    color: '#b7a8ff'
  },
  moreButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  moreText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#aba4d0'
  },
  chevron: {
    width: 22,
    textAlign: 'center',
    fontSize: 26,
    color: '#9f95d4'
  }
});
