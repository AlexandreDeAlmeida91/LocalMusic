import React,{useEffect,useRef,useState} from 'react';
import {Modal,SafeAreaView,View,Text,Pressable,ActivityIndicator,Alert} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import {beginExclusiveStorageWork} from '../services/cacheStorage';
import {saveLibrary} from '../services/library';
import {savePlaylists} from '../services/playlists';
import {updatePreferences} from '../services/preferences';
import {TrackPlayer} from '../services/player';
import {useMusic} from '../context/MusicContext';
const native=requireOptionalNativeModule('PeakBackup');
export default function BackupModal({visible,available,onClose,onRestored}) {
 const {songs,playlists}=useMusic();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[preview,setPreview]=useState(null);
 const release=useRef(null);
 const engine=()=>{if(!native)throw Error('Installe la nouvelle IPA pour utiliser les sauvegardes.');return native;};
 const unlock=()=>{release.current?.();release.current=null;};
 useEffect(()=>()=>unlock(),[]);
 const close=async()=>{if(busy)return;if(preview)await native?.discardStage(preview.stage).catch(()=>{});setPreview(null);unlock();onClose();};
 const snapshot=async()=>{await updatePreferences({});await saveLibrary(songs);await savePlaylists(playlists);};
 const exportFile=async()=>{
  let uri;setBusy(true);setMessage('Préparation de la sauvegarde… Garde Peak Music ouvert.');
  try{engine();release.current=beginExclusiveStorageWork();await snapshot();uri=await native.exportBackup();const shared=await native.shareBackup(uri);setMessage(shared?'Sauvegarde transmise à la destination choisie.':'Partage annulé : aucune sauvegarde exportée.');}
  catch(e){setMessage(e.message);}finally{if(uri)await FS.deleteAsync(uri,{idempotent:true}).catch(()=>{});unlock();setBusy(false);}
 };
 const inspect=async()=>{
  setBusy(true);setMessage('');let picked;
  try{engine();release.current=beginExclusiveStorageWork();picked=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:false,copyToCacheDirectory:true});if(picked.canceled){unlock();return;}setMessage('Vérification de la sauvegarde…');const info=await native.inspectBackup(picked.assets[0].uri);setPreview(info);setMessage('Sauvegarde vérifiée. La bibliothèque actuelle n’a pas encore été modifiée.');}
  catch(e){setMessage(e.message);unlock();}finally{if(picked?.assets?.[0]?.uri?.startsWith(FS.cacheDirectory))await FS.deleteAsync(picked.assets[0].uri,{idempotent:true}).catch(()=>{});setBusy(false);}
 };
 const restore=async()=>{setBusy(true);setMessage('Restauration…');try{TrackPlayer.pause();TrackPlayer.clear();await native.restoreBackup(preview.stage);setPreview(null);unlock();onRestored();}catch(e){setMessage(e.message);}finally{setBusy(false);}};
 return <Modal visible={visible} animationType="slide" onRequestClose={close}><SafeAreaView style={{flex:1,backgroundColor:'#090b15'}}><View style={{padding:24,gap:20}}>
 <Text style={{color:'white',fontSize:27,fontWeight:'800'}}>Sauvegarde complète</Text>
 <Text style={{color:'#b9b4ce',lineHeight:23}}>Le fichier .peakbackup contient tes sons, pochettes, paroles synchronisées, playlists et réglages. Enregistre-le hors du dossier Peak Music, par exemple dans iCloud Drive. Prévois assez d’espace pour une copie de ta bibliothèque.</Text>
 <Text style={{color:'#b9b4ce'}}>Les téléchargements en attente et le cache ne sont pas exportés. La restauration remplace la bibliothèque actuelle après vérification du fichier.</Text>
 {!!message&&<Text style={{color:'#ddd'}}>{message}</Text>}{busy&&<ActivityIndicator/>}
 {preview&&<Text style={{color:'white'}}>{preview.songs} morceaux · {preview.playlists} playlists · {(preview.bytes/1024/1024).toFixed(1)} Mo</Text>}
 {(preview ? [['Remplacer ma bibliothèque',()=>Alert.alert('Remplacer la bibliothèque ?', 'Les morceaux et playlists actuels seront remplacés. Exporte-les d’abord si tu souhaites les conserver.',[{text:'Annuler',style:'cancel'},{text:'Restaurer',style:'destructive',onPress:restore}])],['Annuler',close]] : [['Exporter une sauvegarde',exportFile],['Choisir une sauvegarde à restaurer',inspect],['Fermer',close]]).map(([label,fn])=><Pressable key={label} disabled={busy||!available} onPress={fn} style={{padding:18,borderRadius:16,backgroundColor:'#49328c',opacity:busy||!available?.5:1}}><Text style={{color:'white'}}>{label}</Text></Pressable>)}
 </View></SafeAreaView></Modal>;
}
