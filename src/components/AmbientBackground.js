import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function AmbientBackground({ stronger = false }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.base} />
      <View
        style={[
          styles.glow,
          styles.glowTop,
          stronger && styles.glowTopStrong
        ]}
      />
      <View style={[styles.glow, styles.glowMiddle]} />
      <View
        style={[
          styles.glow,
          styles.glowBottom,
          stronger && styles.glowBottomStrong
        ]}
      />
      <View style={styles.vignetteTop} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070913'
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(96, 70, 255, 0.14)'
  },
  glowTop: {
    width: 420,
    height: 420,
    top: -250,
    right: -155
  },
  glowTopStrong: {
    backgroundColor: 'rgba(110, 78, 255, 0.22)'
  },
  glowMiddle: {
    width: 330,
    height: 330,
    top: '34%',
    left: -250,
    backgroundColor: 'rgba(73, 54, 190, 0.10)'
  },
  glowBottom: {
    width: 470,
    height: 470,
    bottom: -320,
    right: -190,
    backgroundColor: 'rgba(91, 63, 230, 0.13)'
  },
  glowBottomStrong: {
    backgroundColor: 'rgba(112, 75, 255, 0.19)'
  },
  vignetteTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 140,
    backgroundColor: 'rgba(4, 5, 12, 0.16)'
  }
});
