import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Slider from '@react-native-community/slider';
import Artwork from './Artwork';
import AmbientBackground from './AmbientBackground';
import PlaybackModeBar from './PlaybackModeBar';
import LyricsModal from './LyricsModal';
import { useMusic } from '../context/MusicContext';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');
  return `${minutes}:${secs}`;
}

export default function PlayerModal() {
  const {
    currentSong,
    activeQueueName,
    isPlaying,
    currentTime,
    duration,
    volume,
    playerVisible,
    setPlayerVisible,
    togglePlayPause,
    next,
    previous,
    seekTo,
    setVolume
  } = useMusic();

  const [sliderValue, setSliderValue] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [lyricsVisible, setLyricsVisible] = useState(false);

  useEffect(() => {
    if (!seeking) {
      setSliderValue(currentTime);
    }
  }, [currentTime, seeking]);

  if (!currentSong) return null;

  return (
    <Modal
      visible={playerVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setPlayerVisible(false)}
    >
      <SafeAreaView style={styles.safe}>
        <AmbientBackground stronger />

        <View style={styles.header}>
          <Pressable
            onPress={() => setPlayerVisible(false)}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.closeText}>⌄</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Lecture</Text>
            <Text style={styles.queueName} numberOfLines={1}>
              {activeQueueName}
            </Text>
          </View>

          {currentSong.lyricsUri ? (
            <Pressable
              onPress={() => setLyricsVisible(true)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.lyricsHeaderButton,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.lyricsHeaderText}>Paroles</Text>
            </Pressable>
          ) : (
            <View style={styles.lyricsHeaderSpacer} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.artworkGlow}>
            <Artwork
              uri={currentSong.artworkUri}
              size={300}
              radius={26}
            />
          </View>

          <View style={styles.metadata}>
            <Text style={styles.title} numberOfLines={2}>
              {currentSong.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentSong.artist}
            </Text>
            {currentSong.album !== 'Album inconnu' && (
              <Text style={styles.album} numberOfLines={1}>
                {currentSong.album}
              </Text>
            )}
          </View>

          <View style={styles.progress}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={Math.max(duration, 1)}
              value={Math.min(sliderValue, Math.max(duration, 1))}
              minimumTrackTintColor="#8066ff"
              maximumTrackTintColor="#34364a"
              thumbTintColor="#9b84ff"
              onSlidingStart={() => setSeeking(true)}
              onValueChange={setSliderValue}
              onSlidingComplete={(value) => {
                setSeeking(false);
                seekTo(value);
              }}
            />

            <View style={styles.times}>
              <Text style={styles.time}>{formatTime(sliderValue)}</Text>
              <Text style={styles.time}>
                -{formatTime(Math.max(duration - sliderValue, 0))}
              </Text>
            </View>
          </View>

          <View style={styles.controls}>
            <Pressable
              onPress={previous}
              hitSlop={16}
              style={({ pressed }) => [
                styles.sideControl,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.sideControlText}>|◀</Text>
            </Pressable>

            <Pressable
              onPress={togglePlayPause}
              style={({ pressed }) => [
                styles.mainControl,
                pressed && styles.mainControlPressed
              ]}
            >
              <Text style={styles.mainControlText}>
                {isPlaying ? 'Ⅱ' : '▶'}
              </Text>
            </Pressable>

            <Pressable
              onPress={next}
              hitSlop={16}
              style={({ pressed }) => [
                styles.sideControl,
                pressed && styles.pressed
              ]}
            >
              <Text style={styles.sideControlText}>▶|</Text>
            </Pressable>
          </View>

          <View style={styles.modeWrap}>
            <PlaybackModeBar compact />
          </View>

          <View style={styles.volumeRow}>
            <Text style={styles.speaker}>🔈</Text>
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              minimumTrackTintColor="#8066ff"
              maximumTrackTintColor="#34364a"
              thumbTintColor="#9b84ff"
              onValueChange={setVolume}
            />
            <Text style={styles.speaker}>🔊</Text>
          </View>
        </View>

        <LyricsModal
          visible={lyricsVisible}
          song={currentSong}
          onClose={() => setLyricsVisible(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#070913'
  },
  header: {
    minHeight: 64,
    marginHorizontal: 12,
    marginTop: 4,
    paddingHorizontal: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(20, 21, 39, 0.68)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(152, 130, 255, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(39, 37, 70, 0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(156, 135, 255, 0.30)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontSize: 31,
    lineHeight: 33,
    color: '#ffffff',
    marginTop: -5
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center'
  },
  lyricsHeaderButton: {
    minWidth: 70,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(89, 58, 202, 0.44)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(161, 138, 255, 0.56)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  lyricsHeaderSpacer: {
    width: 70,
    height: 40
  },
  lyricsHeaderText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#c0b2ff'
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#f7f5ff'
  },
  queueName: {
    marginTop: 3,
    maxWidth: 180,
    fontSize: 11,
    color: '#9892b7'
  },
  content: {
    flex: 1,
    paddingHorizontal: 28
  },
  artworkGlow: {
    alignSelf: 'center',
    marginTop: 28,
    borderRadius: 28,
    shadowColor: '#6b4cff',
    shadowOpacity: 0.34,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 }
  },
  metadata: {
    marginTop: 30
  },
  title: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5
  },
  artist: {
    marginTop: 7,
    fontSize: 19,
    fontWeight: '600',
    color: '#aaa5c1'
  },
  album: {
    marginTop: 5,
    fontSize: 13,
    color: '#7f7a98'
  },
  progress: {
    marginTop: 22
  },
  slider: {
    width: '100%',
    height: 34
  },
  times: {
    marginTop: -2,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  time: {
    fontSize: 12,
    color: '#a29db8',
    fontVariant: ['tabular-nums']
  },
  controls: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 34
  },
  sideControl: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(24, 26, 47, 0.90)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(147, 126, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sideControlText: {
    fontSize: 23,
    fontWeight: '800',
    color: '#ffffff'
  },
  mainControl: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#684cff',
    borderWidth: 1,
    borderColor: '#a18dff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7658ff',
    shadowOpacity: 0.58,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 7 }
  },
  mainControlPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }]
  },
  mainControlText: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    marginLeft: 2
  },
  modeWrap: {
    marginTop: 24
  },
  volumeRow: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  speaker: {
    fontSize: 16
  },
  volumeSlider: {
    flex: 1,
    height: 34
  },
  pressed: {
    opacity: 0.70
  }
});
