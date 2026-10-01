import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Artwork from './Artwork';
import { useMusic } from '../context/MusicContext';

export default function MiniPlayer() {
  const {
    currentSong,
    isPlaying,
    togglePlayPause,
    next,
    setPlayerVisible
  } = useMusic();

  if (!currentSong) return null;

  return (
    <Pressable
      onPress={() => setPlayerVisible(true)}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
    >
      <Artwork uri={currentSong.artworkUri} size={48} radius={10} />

      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {currentSong.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {currentSong.artist}
        </Text>
      </View>

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          togglePlayPause();
        }}
        hitSlop={12}
        style={styles.control}
      >
        <Text style={styles.controlText}>
          {isPlaying ? 'Ⅱ' : '▶'}
        </Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          next();
        }}
        hitSlop={12}
        style={styles.control}
      >
        <Text style={styles.nextText}>▶|</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    marginBottom: 8,
    minHeight: 70,
    borderRadius: 22,
    paddingHorizontal: 11,
    backgroundColor: 'rgba(27, 27, 52, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(154, 131, 255, 0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#6d4dff',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 }
  },
  pressed: {
    opacity: 0.84
  },
  texts: {
    flex: 1,
    minWidth: 0
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff'
  },
  artist: {
    marginTop: 3,
    fontSize: 12,
    color: '#aaa4c9'
  },
  control: {
    width: 38,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  controlText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff'
  },
  nextText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff'
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.16)'
  }
});
