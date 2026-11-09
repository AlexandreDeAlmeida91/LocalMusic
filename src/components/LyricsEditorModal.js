import React, {useEffect,useRef,useState} from 'react';
import {Modal,SafeAreaView,ScrollView,View,Text,TextInput,Pressable,ActivityIndicator,StyleSheet,KeyboardAvoidingView,Platform,Alert} from 'react-native';
import {lyricIdentity,searchLyricsChoices} from '../services/onlineLyrics';
import {readLyrics} from '../services/lyrics';

export default function LyricsEditorModal({song,onClose,onSave,onImport}) {
  const [mode,setMode]=useState('choose');
  const [title,setTitle]=useState(''); const [artist,setArtist]=useState('');
  const [text,setText]=useState(''); const [results,setResults]=useState([]);
  const [selected,setSelected]=useState(null); const [busy,setBusy]=useState(false);
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const dirty=useRef(false);const request=useRef(null);const generation=useRef(0);
  useEffect(()=>{
    dirty.current=false;const seq=++generation.current;request.current?.abort();
    setMode('choose');setResults([]);setSelected(null);setText('');setError('');setBusy(false);
    if(song){const q=lyricIdentity(song);setTitle(q.title);setArtist(q.artist);
      if(song.lyricsUri)readLyrics(song.lyricsUri).then(t=>{if(seq===generation.current&&!dirty.current)setText(t);});}
    return ()=>{generation.current++;request.current?.abort();};
  },[song?.id]);
  const close=()=>{if(saving)return;generation.current++;request.current?.abort();onClose();};
  const search=async()=>{
    request.current?.abort();const c=new AbortController();request.current=c;
    setBusy(true);setError('');setSelected(null);setResults([]);
    try{const found=await searchLyricsChoices(title,artist,c.signal);if(!c.signal.aborted){setResults(found);if(!found.length)setError('Aucune parole trouvée. Essaie un titre plus simple ou un autre nom d’artiste.');}}
    catch(e){if(!c.signal.aborted)setError(e.message || 'Recherche impossible');}
    finally{if(request.current===c)setBusy(false);}
  };
  const save=async()=>{
    const content=mode==='paste'?text:selected?.text;
    if(!content?.trim()){setError('Ajoute du texte ou choisis un résultat.');return;}
    if(content.length>60000){setError('Le texte dépasse 60 000 caractères.');return;}
    setSaving(true);setError('');
    try{await onSave(song,{text:content.trim(),timing:mode==='paste'?null:selected?.timing,source:mode==='paste'?'Texte personnel':selected.source,sourceUrl:mode==='paste'?null:selected.sourceUrl});onClose();}
    catch(e){setError(e.message || 'Enregistrement impossible');}finally{setSaving(false);}
  };
  const confirmSave=()=>song?.lyricsUri?Alert.alert('Remplacer les paroles ?', 'Le nouveau texte remplacera les paroles associées à ce morceau.',[{text:'Annuler',style:'cancel'},{text:'Remplacer',onPress:save}]):save();
  const button=(label,action,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={[s.button,disabled&&{opacity:0.4}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
  return <Modal visible={!!song} animationType="slide" onRequestClose={close}>
    <SafeAreaView style={s.page}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={s.header}><Text style={s.heading}>Ajouter des paroles</Text>{button('Fermer',close,saving)}</View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
        <Text style={s.title}>{song?.title}</Text>
        {mode==='choose'?<>
          {button('Coller ou écrire les paroles',()=>setMode('paste'))}
          {button('Rechercher en ligne',()=>setMode('search'))}
        </>:<>
          {button('‹ Les deux options',()=>{request.current?.abort();setMode('choose');setError('');},saving)}
          {mode==='paste'?<>
            <Text style={s.hint}>Colle ou saisis le texte. Tu peux aussi importer un fichier TXT.</Text>
            <TextInput accessibilityLabel="Texte des paroles" style={[s.input,{minHeight:280}]} multiline textAlignVertical="top" value={text} onChangeText={value=>{dirty.current=true;setText(value);}} editable={!saving} placeholder="Colle les paroles ici…" placeholderTextColor="#999" maxLength={60001}/>
            {onImport&&button('Importer un fichier .txt',async()=>{setSaving(true);try{if(await onImport(song))onClose();}catch(e){setError(e.message || 'Import impossible');}finally{setSaving(false);}},saving)}
          </>:<>
            <Text style={s.hint}>Modifie les informations recherchées si le nom du fichier contient un remix, un anime ou le nom d’une chaîne. Le morceau ne sera pas renommé.</Text>
            <TextInput accessibilityLabel="Titre recherché" placeholder="Titre" placeholderTextColor="#999" style={s.input} value={title} onChangeText={setTitle} editable={!busy&&!saving}/>
            <TextInput accessibilityLabel="Artiste recherché" placeholder="Artiste" placeholderTextColor="#999" style={s.input} value={artist} onChangeText={setArtist} editable={!busy&&!saving}/>
            {button('Rechercher',search,busy||saving)}
            {busy&&<ActivityIndicator color="#b29dff"/>}
            {results.map((r,i)=><Pressable key={r.id+'-'+i} disabled={saving} onPress={()=>setSelected(r)} style={[s.card,selected===r&&s.selected]} accessibilityRole="button">
              <Text style={s.title}>{r.artist} — {r.title}</Text><Text style={s.hint}>{r.source}{r.timing?' · Synchronisées':''}{r.album?' · '+r.album:''}</Text>
              <Text style={s.hint} numberOfLines={3}>{r.text}</Text>
            </Pressable>)}
            {selected&&<View style={s.card}><Text style={s.title}>Aperçu complet</Text><Text selectable style={s.preview}>{selected.text}</Text></View>}
          </>}
          {button(saving?'Enregistrement…':'Associer ces paroles au morceau',confirmSave,saving||busy||(mode==='search'&&!selected))}
        </>}
        {!!error&&<Text style={s.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#090b15'},header:{padding:16,flexDirection:'row',alignItems:'center',gap:8},heading:{flex:1,color:'#fff',fontSize:22,fontWeight:'800'},body:{padding:18,gap:14,paddingBottom:50},button:{padding:15,backgroundColor:'#392c70',borderRadius:14,minHeight:46},buttonText:{color:'#eee9ff',fontWeight:'700',textAlign:'center'},title:{color:'#fff',fontSize:17,fontWeight:'700'},hint:{color:'#b9b4ce',fontSize:14,lineHeight:21},input:{color:'#fff',backgroundColor:'#202237',borderRadius:12,padding:14,fontSize:16},card:{padding:14,borderRadius:12,backgroundColor:'#191b2f',gap:8,borderWidth:1,borderColor:'#39334d'},selected:{borderColor:'#a995ff',borderWidth:2},preview:{color:'#eee9ff',fontSize:17,lineHeight:26},error:{color:'#ff9caa'}});
