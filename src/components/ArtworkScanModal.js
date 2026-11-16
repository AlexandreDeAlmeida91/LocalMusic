import React, {useEffect, useRef, useState} from 'react';
import {Modal, SafeAreaView, ScrollView, Text, Pressable, Switch, View, ActivityIndicator} from 'react-native';
import {useMusic} from '../context/MusicContext';
import {beginExclusiveStorageWork} from '../services/cacheStorage';
import {artworkCandidatesForSong} from '../services/linkImport';

export default function ArtworkScanModal({visible, onClose}) {
  const {songs, applyScannedArtwork} = useMusic();
  const [youtube, setYoutube] = useState(true);
  const [replaceYoutube, setReplaceYoutube] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState([]);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async () => {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    let release;
    setBusy(true); setDetails([]);
    let added = 0, absent = 0, failed = 0, done = 0;
    const targets = songs.filter(s => !s.customArtworkPath && (!s.artworkPath || (replaceYoutube && s.artworkSource === 'youtube')));
    const skipped = songs.length - targets.length;
    const report = [];
    try {
      release = beginExclusiveStorageWork();
      for (const song of targets) {
        if (abort.signal.aborted) break;
        setMessage(`${done + 1} / ${targets.length} · ${song.title}`);
        try {
          const found = await artworkCandidatesForSong(song, youtube, abort.signal);
          // Never replace an existing YouTube thumbnail with the same thumbnail.
          const candidates = song.artworkSource === 'youtube' ? found.candidates.filter(c => c.source !== 'youtube') : found.candidates;
          if (abort.signal.aborted) break;
          if (candidates.length && await applyScannedArtwork(song, candidates, abort.signal)) added++;
          else if (!abort.signal.aborted) {
            const error = found.errors.length || candidates.length;
            if (error) failed++; else absent++;
            report.push(`${song.title} : ${found.errors[0] || (candidates.length ? 'Image non récupérée.' : found.hasLink ? 'Aucune pochette disponible via les liens conservés.' : 'Aucun lien source conservé.')}`);
          }
        } catch (e) {
          if (abort.signal.aborted) break;
          failed++; report.push(`${song.title} : ${e.message}`);
        }
        done++;
      }
      setMessage(`${abort.signal.aborted ? 'Scan arrêté' : 'Scan terminé'} · ${added} pochette(s) ajoutée(s) · ${skipped} conservée(s) · ${absent} introuvable(s) · ${failed} échec(s)${abort.signal.aborted ? ` · ${Math.max(0,targets.length-done)} restant(s)` : ''}.`);
      setDetails(report);
    } catch (e) { setMessage(e.message); }
    finally { release?.(); controller.current = null; setBusy(false); }
  };
  const close = () => { if (!busy) onClose(); };
  return <Modal visible={visible} animationType="slide" onRequestClose={close}><SafeAreaView style={{flex:1, backgroundColor:'#090b15'}}><ScrollView contentContainerStyle={{padding:24,gap:20}}>
    <Text style={{color:'white',fontSize:28,fontWeight:'800'}}>Rechercher les pochettes</Text>
    <Text style={{color:'#b9b4ce',lineHeight:23}}>Le scan utilise les liens conservés : Spotify en priorité, puis SoundCloud et éventuellement YouTube. Il ne recherche pas par nom sur les plateformes. Les pochettes choisies manuellement sont conservées et aucun son n’est retéléchargé.</Text>
    <Text style={{color:'#b9b4ce'}}>Garde Peak Music ouvert pendant le scan. Les résultats sont enregistrés au fur et à mesure.</Text>
    {[[youtube,setYoutube,'Utiliser les miniatures YouTube en secours'],[replaceYoutube,setReplaceYoutube,'Remplacer aussi les miniatures YouTube existantes']].map(([value,change,label]) => <View key={label} style={{flexDirection:'row',alignItems:'center',gap:12}}><Text style={{color:'white',flex:1}}>{label}</Text><Switch value={value} onValueChange={change} disabled={busy}/></View>)}
    {!!message && <Text accessibilityLiveRegion="polite" style={{color:'#ddd',lineHeight:23}}>{message}</Text>}
    {busy && <ActivityIndicator color="#ae96ff"/>}
    <Pressable onPress={busy ? () => {controller.current?.abort();setMessage('Arrêt après la requête en cours…');} : run} style={{backgroundColor:'#49328c',padding:18,borderRadius:16}}><Text style={{color:'white',textAlign:'center'}}>{busy ? 'Arrêter le scan' : 'Scanner la bibliothèque'}</Text></Pressable>
    <Pressable disabled={busy} onPress={close} style={{padding:18,opacity:busy?0.4:1}}><Text style={{color:'#b6a4ff',textAlign:'center'}}>Fermer</Text></Pressable>
    {details.map((detail,i) => <Text key={i} style={{color:'#b9b4ce',fontSize:13}}>{detail}</Text>)}
  </ScrollView></SafeAreaView></Modal>;
}
