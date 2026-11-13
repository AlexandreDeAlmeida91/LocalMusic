import React,{useEffect,useState} from 'react';
import {Modal,SafeAreaView,View,Text,TextInput,Pressable,ActivityIndicator} from 'react-native';
export default function MetadataModal({song,onClose,onSave}) {
 const [title,setTitle]=useState(''),[artist,setArtist]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setTitle(song?.title || '');setArtist(song?.artist || '');setError('');},[song]);
 const save=async()=>{setBusy(true);setError('');try{await onSave(song.id,title,artist);onClose();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <Modal visible={!!song} animationType="slide" onRequestClose={()=>!busy&&onClose()}><SafeAreaView style={{flex:1,backgroundColor:'#090b15'}}><View style={{padding:24,gap:20}}>
 <Text style={{color:'white',fontSize:26,fontWeight:'800'}}>Titre et artiste</Text>
 <Text style={{color:'#aaa5c1'}}>Ces informations sont enregistrées dans Peak Music et utilisées pour les recherches de paroles. Le fichier audio reste inchangé.</Text>
 {[['Titre',title,setTitle],['Artiste',artist,setArtist]].map(([label,value,set])=><View key={label}><Text style={{color:'#ddd',marginBottom:8}}>{label}</Text><TextInput accessibilityLabel={label} maxLength={300} editable={!busy} value={value} onChangeText={set} style={{color:'white',padding:16,backgroundColor:'#202237',borderRadius:12}}/></View>)}
 {!!error&&<Text style={{color:'#ff9caa'}}>{error}</Text>}{busy&&<ActivityIndicator/>}
 {[['Enregistrer',save],['Annuler',onClose]].map(([label,fn])=><Pressable key={label} disabled={busy} onPress={fn} style={{padding:18,borderRadius:16,backgroundColor:'#49328c'}}><Text style={{color:'white'}}>{label}</Text></Pressable>)}
 </View></SafeAreaView></Modal>;
}
