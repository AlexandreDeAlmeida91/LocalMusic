import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export default function Artwork({ uri, size = 54, radius = 10 }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: radius }
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
        style={[
          styles.note,
          { fontSize: Math.max(20, size * 0.38) }
        ]}
      >
        ♪
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#17192a'
  },
  placeholder: {
    backgroundColor: '#17192a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(151, 128, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  note: {
    color: '#9a83ff',
    fontWeight: '900'
  }
});
