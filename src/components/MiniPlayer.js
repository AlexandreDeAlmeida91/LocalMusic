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
      style={styles.container}
    >
      <Artwork uri={currentSong.artworkUri} size={46} radius={8} />

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
    minHeight: 62,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(245,245,248,0.97)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7d7dc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  texts: {
    flex: 1
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111'
  },
  artist: {
    marginTop: 2,
    fontSize: 12,
    color: '#6f6f76'
  },
  control: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  controlText: {
    fontSize: 22,
    fontWeight: '700'
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700'
  }
});
