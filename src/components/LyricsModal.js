import AutoLyricsModal from './AutoLyricsModal';
import {timedLines, validTiming, activeLyric} from '../services/lyricsTiming';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import LyricsEditorModal from './LyricsEditorModal';
import {useMusic} from '../context/MusicContext';
import AmbientBackground from './AmbientBackground';

const MIN_FONT_SIZE = 19;
const MAX_FONT_SIZE = 32;
const DEFAULT_FONT_SIZE = 24;

export default function LyricsModal({
  visible,
  song,
  onClose
}) {
  const {saveChosenLyrics, addOrReplaceLyrics, saveLyricsTiming, currentTime} = useMusic();
  const [autoOpen,setAutoOpen] = useState(false);
  const scrollRef = useRef(null);
  const positions = useRef({});
  const blockY = useRef(0);
  const [follow,setFollow] = useState(true);
  const [editing,setEditing] = useState(false);
  useEffect(() => {setAutoOpen(false);setEditing(false);setFollow(true);positions.current={};}, [visible, song?.id, song?.lyricsUri]);
  const [lyrics, setLyrics] = useState('');
  const [loading, setLoading] = useState(false);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

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

  const lines = useMemo(() => timedLines(lyrics), [lyrics]);
  const timed = validTiming(song?.lyricsTiming, lyrics);
  const active = timed ? activeLyric(song.lyricsTiming.times, currentTime) : -1;
  useEffect(() => {
    if (visible && follow && active >= 0 && positions.current[active] !== undefined)
      scrollRef.current?.scrollTo({y: Math.max(0, blockY.current + positions.current[active] - 90), animated:true});
  }, [active, follow, visible, fontSize]);
  const decreaseFont = () => {
    setFontSize((current) => Math.max(MIN_FONT_SIZE, current - 2));
  };

  const increaseFont = () => {
    setFontSize((current) => Math.min(MAX_FONT_SIZE, current + 2));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <AmbientBackground stronger />
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.backButton}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Paroles</Text>

          <View style={styles.fontControls}>
            <Pressable
              onPress={decreaseFont}
              disabled={fontSize <= MIN_FONT_SIZE}
              style={({ pressed }) => [
                styles.fontButton,
                pressed && styles.fontButtonPressed,
                fontSize <= MIN_FONT_SIZE && styles.fontButtonDisabled
              ]}
            >
              <Text style={styles.fontButtonText}>A−</Text>
            </Pressable>

            <Pressable
              onPress={increaseFont}
              disabled={fontSize >= MAX_FONT_SIZE}
              style={({ pressed }) => [
                styles.fontButton,
                pressed && styles.fontButtonPressed,
                fontSize >= MAX_FONT_SIZE && styles.fontButtonDisabled
              ]}
            >
              <Text style={styles.fontButtonText}>A+</Text>
            </Pressable>
          </View>
        </View>

        {!!lyrics && <View style={{padding:12,gap:8}}>
          <Pressable style={styles.syncButton} onPress={()=>setAutoOpen(true)}><Text style={styles.fontButtonText}>Essayer la synchronisation automatique locale</Text></Pressable>
          {timed && <Pressable onPress={()=>setFollow(v=>!v)}><Text style={styles.artist}>Défilement automatique : {follow?'activé':'désactivé'}</Text></Pressable>}
        </View>}
        <ScrollView
          ref={scrollRef}
          onScrollBeginDrag={()=>setFollow(false)}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.songHeader}>
            <Text style={styles.title}>
              {song?.title || ''}
            </Text>

            <Text style={styles.artist}>
              {song?.artist || 'Artiste inconnu'}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          ) : lyrics ? (
            <View style={styles.lyricsBlock} onLayout={e=>{blockY.current=e.nativeEvent.layout.y;}}>
              {lines.map((line, index) => {
                const empty = !line.trim();

                if (empty) {
                  return (
                    <View
                      key={`space-${index}`}
                      style={{ height: Math.round(fontSize * 0.75) }}
                    />
                  );
                }

                return (
                  <Text
                    key={`${index}-${line}`}
                    selectable
                    onLayout={e=>{positions.current[index]=e.nativeEvent.layout.y;}}
                    style={[
                      styles.lyricLine,
                      active===index && {color: '#b8a2ff', backgroundColor: 'rgba(105,70,255,0.18)'},
                      {
                        fontSize,
                        lineHeight: Math.round(fontSize * 1.42)
                      }
                    ]}
                  >
                    {line}
                  </Text>
                );
              })}
            </View>
          ) : (
            <Text style={styles.empty}>
              {song?.lyricsStatus || 'Aucune parole disponible pour ce morceau.'}
            </Text>
          )}

          {!!song?.lyricsSource && <Text style={styles.artist}>Source : {song.lyricsSource}</Text>}
          <Pressable style={styles.fontButton} onPress={() => setEditing(true)}>
            <Text style={styles.fontButtonText}>{lyrics ? 'Modifier les paroles' : 'Ajouter des paroles'}</Text>
          </Pressable>
          <View style={styles.bottomSpace} />
        </ScrollView>
        {autoOpen && visible && <AutoLyricsModal song={song} text={lyrics} onClose={()=>setAutoOpen(false)} onSave={saveLyricsTiming} />}
        <LyricsEditorModal song={editing ? song : null} onClose={() => setEditing(false)} onSave={saveChosenLyrics} onImport={addOrReplaceLyrics} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  syncButton: {backgroundColor: '#5036b0',padding:14,borderRadius:12,alignItems:'center'},
  safe: {
    flex: 1,
    backgroundColor: '#070913'
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(151, 128, 255, 0.18)',
    backgroundColor: 'rgba(7, 9, 19, 0.88)'
  },
  backButton: {
    width: 52,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  backText: {
    fontSize: 44,
    lineHeight: 46,
    color: '#ffffff',
    marginTop: -4
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff'
  },
  fontControls: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: 6,
    zIndex: 2
  },
  fontButton: {
    minWidth: 42,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(35, 34, 63, 0.92)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fontButtonPressed: {
    opacity: 0.65
  },
  fontButtonDisabled: {
    opacity: 0.35
  },
  fontButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff'
  },
  scroll: {
    flex: 1
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 30
  },
  songHeader: {
    paddingBottom: 10
  },
  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.6
  },
  artist: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '600',
    color: '#aaa5c1'
  },
  loadingWrap: {
    paddingTop: 80,
    alignItems: 'center'
  },
  lyricsBlock: {
    marginTop: 34
  },
  lyricLine: {
    marginBottom: 17,
    fontFamily: 'Avenir Next',
    fontWeight: '700',
    color: '#f7f7f9',
    letterSpacing: 0.15,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  empty: {
    marginTop: 42,
    fontSize: 18,
    lineHeight: 27,
    color: '#aaa5c1'
  },
  bottomSpace: {
    height: 120
  }
});
