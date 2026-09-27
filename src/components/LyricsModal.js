import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { readLyrics } from '../services/lyrics';

export default function LyricsModal({
  visible,
  song,
  onClose
}) {
  const [lyrics, setLyrics] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!visible || !song?.lyricsUri) {
      setLyrics('');
      return () => {
        active = false;
      };
    }

    setLoading(true);

    readLyrics(song.lyricsUri)
      .then((text) => {
        if (active) setLyrics(text);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [song?.id, song?.lyricsUri, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Paroles</Text>

          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>
            {song?.title || ''}
          </Text>

          <Text style={styles.artist}>
            {song?.artist || 'Artiste inconnu'}
          </Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" />
            </View>
          ) : lyrics ? (
            <Text selectable style={styles.lyrics}>
              {lyrics}
            </Text>
          ) : (
            <Text style={styles.empty}>
              Aucune parole disponible pour ce morceau.
            </Text>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8f8fb'
  },
  header: {
    height: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dedee4'
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backText: {
    fontSize: 42,
    lineHeight: 44,
    color: '#111',
    marginTop: -4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111'
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingHorizontal: 26,
    paddingTop: 28
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: '#111'
  },
  artist: {
    marginTop: 7,
    fontSize: 17,
    color: '#73737b'
  },
  loadingWrap: {
    paddingTop: 70,
    alignItems: 'center'
  },
  lyrics: {
    marginTop: 38,
    fontSize: 21,
    lineHeight: 34,
    fontWeight: '600',
    color: '#17171a'
  },
  empty: {
    marginTop: 38,
    fontSize: 17,
    lineHeight: 25,
    color: '#85858c'
  },
  bottomSpace: {
    height: 80
  }
});
