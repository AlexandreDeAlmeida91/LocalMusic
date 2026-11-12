import React, {useEffect,useState} from 'react';
import {requireOptionalNativeModule} from 'expo';
import {beginCacheWork} from '../services/cacheStorage';
import {serialQueue} from '../services/workQueue';
const thumbnails = serialQueue();
import { Image, StyleSheet, Text, View } from 'react-native';

export default function Artwork({ uri, size = 54, radius = 10 }) {
  const [small,setSmall] = useState(null);
  useEffect(()=>{
    let alive=true;
    setSmall(null);
    if(uri?.startsWith('file:') && size <= 100) {
      thumbnails(async()=>{
        if(!alive)return;
        const engine=requireOptionalNativeModule('PeakImport');
        if(typeof engine?.thumbnail !== 'function')return;
        const end=beginCacheWork();
        try {const result=await engine.thumbnail(uri);if(alive)setSmall({source:uri,uri:result});}
        finally{end();}
      }).catch(()=>{});
    }
    return()=>{alive=false;};
  },[uri,size]);
  if (uri) {
    return (
      <Image
        source={{ uri:small?.source===uri ? small.uri : uri }}
        onError={()=>setSmall(null)}
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
