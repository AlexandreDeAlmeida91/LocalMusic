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
import PlaybackModeBar from './PlaybackModeBar';
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
        <View style={styles.header}>
          <Pressable
            onPress={() => setPlayerVisible(false)}
            hitSlop={12}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>⌄</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Lecture</Text>
            <Text style={styles.queueName} numberOfLines={1}>
              {activeQueueName}
            </Text>
          </View>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.content}>
          <View style={styles.artworkWrap}>
            <Artwork
              uri={currentSong.artworkUri}
              size={300}
              radius={24}
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
              minimumTrackTintColor="#4b35d1"
              maximumTrackTintColor="#c9c9ce"
              thumbTintColor="#4b35d1"
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
              style={styles.sideControl}
            >
              <Text style={styles.sideControlText}>|◀</Text>
            </Pressable>

            <Pressable
              onPress={togglePlayPause}
              style={styles.mainControl}
            >
              <Text style={styles.mainControlText}>
                {isPlaying ? 'Ⅱ' : '▶'}
              </Text>
            </Pressable>

            <Pressable
              onPress={next}
              hitSlop={16}
              style={styles.sideControl}
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
              minimumTrackTintColor="#5f5f66"
              maximumTrackTintColor="#c9c9ce"
              thumbTintColor="#5f5f66"
              onValueChange={setVolume}
            />
            <Text style={styles.speaker}>🔊</Text>
          </View>
        </View>
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
    height: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontSize: 32,
    lineHeight: 34,
    color: '#222'
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#444'
  },
  queueName: {
    marginTop: 2,
    maxWidth: 220,
    fontSize: 11,
    color: '#8a8a92'
  },
  content: {
    flex: 1,
    paddingHorizontal: 28
  },
  artworkWrap: {
    alignItems: 'center',
    marginTop: 20
  },
  metadata: {
    marginTop: 34
  },
  title: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '800',
    color: '#111'
  },
  artist: {
    marginTop: 6,
    fontSize: 19,
    color: '#66666d'
  },
  album: {
    marginTop: 5,
    fontSize: 14,
    color: '#96969c'
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
    color: '#77777d',
    fontVariant: ['tabular-nums']
  },
  controls: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 38
  },
  sideControl: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sideControlText: {
    fontSize: 25,
    fontWeight: '700'
  },
  mainControl: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center'
  },
  mainControlText: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    marginLeft: 2
  },
  modeWrap: {
    marginTop: 24
  },
  volumeRow: {
    marginTop: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  speaker: {
    fontSize: 16
  },
  volumeSlider: {
    flex: 1,
    height: 34
  }
});
