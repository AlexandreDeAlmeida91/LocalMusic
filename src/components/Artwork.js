import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

export default function Artwork({ uri, size = 54, radius = 10 }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
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
      <Text style={{ fontSize: Math.max(20, size * 0.38) }}>♪</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#e9e9ee',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
