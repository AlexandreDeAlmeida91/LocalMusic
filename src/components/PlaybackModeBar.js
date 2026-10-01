import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useMusic } from '../context/MusicContext';

function repeatLabel(mode) {
  if (mode === 'one') return 'Boucle 1';
  if (mode === 'all') return 'Boucle tout';
  return 'Boucle';
}

export default function PlaybackModeBar({ compact = false }) {
  const {
    shuffleEnabled,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode
  } = useMusic();

  return (
    <View style={[styles.row, compact && styles.compactRow]}>
      <Pressable
        onPress={toggleShuffle}
        style={({ pressed }) => [
          styles.button,
          compact && styles.compactButton,
          shuffleEnabled && styles.buttonActive,
          pressed && styles.pressed
        ]}
      >
        <Text
          style={[
            styles.symbol,
            shuffleEnabled && styles.textActive
          ]}
        >
          ⇄
        </Text>
        <Text
          style={[
            styles.label,
            shuffleEnabled && styles.textActive
          ]}
        >
          Aléatoire
        </Text>
      </Pressable>

      <Pressable
        onPress={cycleRepeatMode}
        style={({ pressed }) => [
          styles.button,
          compact && styles.compactButton,
          repeatMode !== 'off' && styles.buttonActive,
          pressed && styles.pressed
        ]}
      >
        <Text
          style={[
            styles.symbol,
            repeatMode !== 'off' && styles.textActive
          ]}
        >
          {repeatMode === 'one' ? '↻¹' : '↻'}
        </Text>
        <Text
          style={[
            styles.label,
            repeatMode !== 'off' && styles.textActive
          ]}
        >
          {repeatLabel(repeatMode)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    gap: 10
  },
  compactRow: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    justifyContent: 'center'
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(144, 123, 235, 0.20)',
    backgroundColor: 'rgba(25, 27, 47, 0.90)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  compactButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10
  },
  buttonActive: {
    backgroundColor: 'rgba(83, 59, 184, 0.48)',
    borderColor: 'rgba(158, 135, 255, 0.62)'
  },
  pressed: {
    opacity: 0.72
  },
  symbol: {
    fontSize: 20,
    fontWeight: '900',
    color: '#9b87ee'
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#efedfa'
  },
  textActive: {
    color: '#b9a8ff'
  }
});
