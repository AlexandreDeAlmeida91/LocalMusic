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
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: radius
          }
        ]}
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
          color: '#9a83ff',
          fontWeight: '900'
        }}
      >
        ♫
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#17192a'
  },
  placeholder: {
    backgroundColor: '#19182d',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(151, 128, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
