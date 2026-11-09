import {lyricsAnalysisError} from '../services/lyricsAnalysisError';
import React,{useState,useRef,useEffect} from 'react';
import {Modal,SafeAreaView,ScrollView,View,Text,Pressable,ActivityIndicator,AppState} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import {alignLyrics} from '../services/autoLyricsAlignment';
import {timedLines} from '../services/lyricsTiming';
import {TrackPlayer} from '../services/player';
const engine=requireOptionalNativeModule('PeakLyrics');
const languages=[['en-US','Anglais'],['fr-FR','Français'],['pt-PT','Portugais'],['es-ES','Espagnol']];
const button={padding:14,backgroundColor:'#46318b',borderRadius:12,marginVertical:5};
const white={color:'#f5f1ff',fontSize:16};
const stamp=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');

export default function AutoLyricsModal({song,text,onClose,onSave}){
 const [locale,setLocale]=useState('en-US'),[busy,setBusy]=useState(false),[fraction,setFraction]=useState(0);
 const [error,setError]=useState(''),[candidate,setCandidate]=useState(null),[saving,setSaving]=useState(false);
 const job=useRef(null),alive=useRef(true);
 const stop=()=>{const id=job.current;job.current=null;if(id)engine?.cancel(id).catch(()=>{});setBusy(false);};
 useEffect(()=>{
  alive.current=true;
  const subscription=engine?.addListener('onAnalysisProgress',e=>{if(e.jobID===job.current)setFraction(e.fraction);});
  const state=AppState.addEventListener('change',s=>{if(s==='background'&&job.current){stop();setError('Analyse interrompue en arrière-plan. Garde Peak Music ouvert.');}});
  return()=>{alive.current=false;const id=job.current;job.current=null;if(id)engine?.cancel(id).catch(()=>{});subscription?.remove();state.remove();};
 },[]);
 const start=async()=>{
  if(!engine){setError('Reconstruis et installe la nouvelle IPA pour activer le moteur local.');return;}
  const id=Date.now()+'-'+Math.random().toString(36).slice(2);
  job.current=id;setBusy(true);setError('');setCandidate(null);setFraction(0);
  try{
   const words=await engine.analyze(song.uri,locale,id);
   if(job.current!==id||!alive.current)return;
   setCandidate(alignLyrics(text,words));
  }catch(e){if(job.current===id&&alive.current)setError(lyricsAnalysisError(e));}
  finally{if(job.current===id){job.current=null;if(alive.current)setBusy(false);}}
 };
 const save=async()=>{
  setSaving(true);setError('');
  try{await onSave(song.id,candidate);onClose();}
  catch(e){setError(e.message||'Enregistrement impossible.');}
  finally{if(alive.current)setSaving(false);}
 };
 return <Modal visible animationType="slide" onRequestClose={()=>{if(!saving){stop();onClose();}}}>
  <SafeAreaView style={{flex:1,backgroundColor:'#090b15'}}>
   <View style={{padding:16}}><Text style={[white,{fontSize:23,fontWeight:'800'}]}>Synchronisation locale · essai</Text>
   <Pressable disabled={saving} style={button} onPress={()=>{stop();onClose();}}><Text style={white}>Fermer</Text></Pressable></View>
   <ScrollView contentContainerStyle={{padding:18,gap:10}}>
    <Text style={white}>{song.title}</Text>
    <Text style={white}>Analyse unique sur cet iPhone, sans envoi du son. La lecture peut continuer pendant l’analyse. Ce moteur de reconnaissance vocale peut échouer sur le chant ou les remixes. Garde l’application ouverte. Aucune modification avant validation.</Text>
    <Text style={white}>Choisis la langue chantée. Le texte doit suivre exactement les passages et répétitions du morceau. Le japonais en romaji n’est pas pris en charge par cet essai.</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{languages.map(([id,label])=><Pressable key={id} disabled={busy||saving} style={[button,locale===id&&{backgroundColor:'#7250dc'}]} onPress={()=>{setLocale(id);setCandidate(null);}}><Text style={white}>{label}</Text></Pressable>)}</View>
    {!busy&&<Pressable disabled={saving} style={button} onPress={start}><Text style={white}>Analyser le fichier audio</Text></Pressable>}
    {busy&&<><ActivityIndicator color="#b8a2ff"/><Text style={white}>Audio traité : {Math.round(fraction*100)} %</Text><Pressable style={button} onPress={stop}><Text style={white}>Annuler l’analyse</Text></Pressable></>}
    {!!error&&<Text style={{color:'#ff9caa'}}>{error}</Text>}
    {candidate&&<>
     <Text style={white}>Repères proposés : {candidate.times.filter(t=>t!==null).length}/{candidate.times.length} lignes. Les estimations sont approximatives. Les lignes non repérées restent sans animation. Touche une ligne datée pour vérifier, surtout les refrains.</Text>
     <Pressable disabled={saving} style={button} onPress={save}><Text style={white}>{saving?'Enregistrement…':'Valider ces repères'}</Text></Pressable>
     {timedLines(text).map((line,i)=><Pressable key={i} disabled={candidate.times[i]===null} style={[button,candidate.times[i]===null&&{opacity:0.5}]} onPress={()=>{TrackPlayer.seekTo(candidate.times[i]);TrackPlayer.play();}}><Text style={white}>{candidate.times[i]===null?'Non repérée':stamp(candidate.times[i])+' · '+(candidate.kinds?.[i]==='estimated'?'Estimée':'Détectée')} — {line}</Text></Pressable>)}
    </>}
   </ScrollView>
  </SafeAreaView>
 </Modal>;
}
