import React,{useEffect,useMemo,useState} from 'react';
import {Modal,SafeAreaView,View,Text,TextInput,Pressable,FlatList,Alert,ActivityIndicator} from 'react-native';
export default function LibraryToolsModal({visible,songs,playlists,sourceId,onApply,onClose}) {
 const [ids,setIds]=useState([]),[query,setQuery]=useState(''),[action,setAction]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(visible){setIds([]);setQuery('');setAction(null);setError('');}},[visible]);
 const selected=useMemo(()=>new Set(ids),[ids]);
 const shown=useMemo(()=>{const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const words=norm(query).split(/\s+/).filter(Boolean);return songs.filter(s=>words.every(w=>norm(s.title+' '+s.artist).includes(w)));},[songs,query]);
 const apply=async(kind,target)=>{if(busy)return;setBusy(true);setError('');try{await onApply(ids,kind,target,sourceId);onClose();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const button=(label,fn,disabled=false)=><Pressable key={label} disabled={busy||disabled} onPress={fn} style={{padding:14,borderRadius:12,backgroundColor:'#33275d',opacity:busy||disabled?.4:1}}><Text style={{color:'white'}}>{label}</Text></Pressable>;
 return <Modal visible={visible} animationType="slide" onRequestClose={()=>!busy&&onClose()}><SafeAreaView style={{flex:1,backgroundColor:'#090b15'}}>
 <View style={{padding:18,gap:10}}><Text style={{color:'white',fontSize:24,fontWeight:'800'}}>Sélection multiple · {ids.length}</Text>
 {button('Fermer',onClose)}{!!error&&<Text style={{color:'#ff9caa'}}>{error}</Text>}{busy&&<ActivityIndicator/>}
 {action ? <><Text style={{color:'#ddd'}}>Choisis la playlist de destination</Text>{button('Retour aux morceaux',()=>setAction(null))}</> : <>
 <TextInput editable={!busy} placeholder="Filtrer la liste" placeholderTextColor="#aaa" value={query} onChangeText={setQuery} style={{padding:14,color:'white',backgroundColor:'#202237',borderRadius:12}}/>
 <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button('Tout sélectionner',()=>setIds([...new Set([...ids,...shown.map(s=>s.id)])]))}{button('Tout désélectionner',()=>setIds([]))}</View>
 <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button('Ajouter à une playlist',()=>setAction('add'),!ids.length)}{sourceId&&button('Déplacer vers…',()=>setAction('move'),!ids.length)}{sourceId&&button('Retirer de cette playlist',()=>apply('remove'),!ids.length)}{button('Supprimer les fichiers',()=>Alert.alert('Supprimer les morceaux sélectionnés ?',`${ids.length} morceau(x) seront retirés de la bibliothèque et de toutes les playlists.`,[{text:'Annuler',style:'cancel'},{text:'Supprimer',style:'destructive',onPress:()=>apply('delete')}]),!ids.length)}</View>
 </>}
 </View>
 {action ? <FlatList data={playlists.filter(p=>action!=='move'||p.id!==sourceId)} keyExtractor={p=>p.id} contentContainerStyle={{padding:18,gap:10}} ListEmptyComponent={<Text style={{color:'#aaa'}}>Crée d’abord une autre playlist.</Text>} renderItem={({item})=>button(item.name,()=>apply(action,item.id))}/> :
 <FlatList data={shown} extraData={ids} keyExtractor={s=>s.id} initialNumToRender={10} windowSize={5} contentContainerStyle={{padding:18,gap:10}} renderItem={({item})=><Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{checked:selected.has(item.id)}} onPress={()=>setIds(v=>v.includes(item.id)?v.filter(id=>id!==item.id):[...v,item.id])} style={{padding:16,backgroundColor:selected.has(item.id)?'#49328c':'#191b2f',borderRadius:12}}><Text numberOfLines={2} style={{color:'white',fontWeight:'700'}}>{selected.has(item.id)?'✓':'○'} {item.title}</Text><Text style={{color:'#aaa5c1'}}>{item.artist}</Text></Pressable>}/>}
 </SafeAreaView></Modal>;
}
