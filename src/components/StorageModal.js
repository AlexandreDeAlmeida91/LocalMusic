import React, {useEffect,useState} from 'react';
import {Modal,SafeAreaView,View,Text,Pressable,ActivityIndicator} from 'react-native';
import {storageUsage,clearAppCache} from '../services/cacheStorage';
const format = n => `${(n / 1024 / 1024).toFixed(1)} Mo`;
export default function StorageModal({visible,onClose}) {
  const [usage,setUsage]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const refresh=async()=>{setBusy(true);setError('');try{setUsage(await storageUsage());}catch(e){setError(e.message);}finally{setBusy(false);}};
  useEffect(()=>{if(visible)refresh();},[visible]);
  const clear=async()=>{setBusy(true);setError('');try{await clearAppCache();setUsage(await storageUsage());}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={{flex:1,backgroundColor:'#090b15'}}><View style={{padding:24,gap:24}}>
    <Text style={{color:'white',fontSize:28,fontWeight:'800'}}>Stockage</Text>
    {usage && Object.entries({audio:'Sons',artwork:'Pochettes des morceaux',lyrics:'Paroles',cache:'Cache et téléchargements temporaires'}).map(([k,label])=><Text key={k} style={{color:'#ddd',fontSize:17}}>{label} : {format(usage[k])}</Text>)}
    <Text style={{color:'#aaa5c1'}}>Le nettoyage conserve tes sons, pochettes originales, paroles, playlists et la file d’import. Les petites pochettes seront recréées à la demande.</Text>
    {!!error && <Text style={{color:'#ff9caa'}}>{error}</Text>}
    {busy && <ActivityIndicator/>}
    {[['Vider uniquement le cache',clear],['Actualiser',refresh],['Fermer',onClose]].map(([label,action])=><Pressable key={label} disabled={busy} onPress={action} style={{padding:18,backgroundColor:'#49328c',borderRadius:16,opacity:busy?.5:1}}><Text style={{color:'white',fontSize:17}}>{label}</Text></Pressable>)}
  </View></SafeAreaView></Modal>;
}
