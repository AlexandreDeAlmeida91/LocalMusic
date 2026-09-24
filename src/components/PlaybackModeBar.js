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
        style={[
          styles.button,
          compact && styles.compactButton,
          shuffleEnabled && styles.buttonActive
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
        style={[
          styles.button,
          compact && styles.compactButton,
          repeatMode !== 'off' && styles.buttonActive
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
    paddingBottom: 10,
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
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#efeff4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7
  },
  compactButton: {
    flex: 0,
    minWidth: 126,
    paddingHorizontal: 12
  },
  buttonActive: {
    backgroundColor: '#ece9ff'
  },
  symbol: {
    fontSize: 18,
    fontWeight: '900',
    color: '#5e5e66'
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#55555d'
  },
  textActive: {
    color: '#4b35d1'
  }
});
