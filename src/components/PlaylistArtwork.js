import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View
} from 'react-native';

export default function PlaylistArtwork({
  uri,
  size = 56,
  radius = 12
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: radius
        }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius: radius
        }
      ]}
    >
      <Text
        style={{
          fontSize: Math.max(24, size * 0.42),
          color: '#4b35d1',
          fontWeight: '900'
        }}
      >
        ♫
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#ece9ff',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
