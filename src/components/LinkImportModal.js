import {createBackgroundGate} from '../services/backgroundGate';
import usePreference from '../hooks/usePreference';
import {serialQueue, runWorkers, pendingImportRows} from '../services/workQueue';
import {readImportJournal, writeImportJournal} from '../services/importJournal';
import {beginCacheWork, cleanupStartup} from '../services/cacheStorage';
import { findOnlineLyrics } from '../services/cachedLyrics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, SafeAreaView, FlatList, StyleSheet, Text, TextInput, View, Switch } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { beginBackgroundImport, updateBackgroundImport, endBackgroundImport, subscribeBackgroundImport, youtubeFallback, expandImportLinks, assertImportEngine, prepareMusicLink, downloadPrepared, cancelNativeImport, subscribeImportProgress } from '../services/linkImport';
import { readableImportError } from '../services/linkParsing';

export default function LinkImportModal({ visible, available=true, onClose, onImported, onFindExisting, onLyrics }) {
  const [allowYoutubeThumbnail, setAllowYoutubeThumbnail] = usePreference('allowYoutubeThumbnail', false);
  const [parallel, setParallel] = usePreference('parallelImports', true);
  const [resume, setResume] = useState(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [backgroundMode, setBackgroundMode] = useState('');
  const [fraction, setFraction] = useState(null);
  const [rows, setRows] = useState([]);
  const [choice, setChoice] = useState(null);
  const [error, setError] = useState('');
  const operation = useRef(null);
  const choose = useRef(null);
  const save = useRef(onImported);
  save.current = onImported;
  const attach = useRef(onLyrics);
  attach.current = onLyrics;
  const lookup = useRef(onFindExisting);
  lookup.current = onFindExisting;

  const cancel = () => {
    const current = operation.current;
    if (!current) return;
    current.controller.abort();
    choose.current?.(null);
    choose.current = null;
    setChoice(null);
    setPhase('Pause après les enregistrements en cours…');
    for (const id of current.jobs) cancelNativeImport(id).catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    Promise.all([cleanupStartup(), readImportJournal()]).then(([,journal]) => {
      if (!alive) return;
      if (journal && pendingImportRows(journal.rows).length) setResume(journal);
      setReady(true);
    }).catch(e => {if(alive)setError(e.message);});
    const subscription = subscribeImportProgress(event => {
      if (!operation.current?.jobs.has(event.jobID) || operation.current.controller.signal.aborted) return;
      setPhase(event.phase);
      setFraction(Number.isFinite(event.fraction) ? event.fraction : null);
    });
    const background = subscribeBackgroundImport(event => {
      const current = operation.current;
      if (!current) return;
      if (event.state === 'active') {
        current.gate.setGranted(true);
        setBackgroundMode('La poursuite de la playlist en arrière-plan est autorisée par iOS.');
      } else if (event.state === 'expired') {
        current.gate.setGranted(false);
        cancel();
        setError('iOS a arrêté le traitement ou celui-ci a été annulé. La file est conservée : touche Reprendre.');
      }
    });
    const state = AppState.addEventListener('change', value => {
      operation.current?.gate.setState(value);
      if (value === 'background' && operation.current) {
        setPhase('Import en arrière-plan · poursuite selon le temps accordé par iOS');
      }
    });
    return () => { alive = false; subscription?.remove(); background?.remove(); state.remove(); cancel(); };

  }, []);

  const start = async (saved = null, onlyFailed = false) => {
    if (operation.current || !ready || !available) return;
    setError('');
    const links = saved ? saved.rows.map(r=>r.url) : [...new Set(input.split(/[;\n\r]+/).map(s=>s.trim()).filter(Boolean))];
    if (!links.length || (!saved && links.length > 20)) {setError('Colle entre 1 et 20 liens.');return;}
    try {assertImportEngine();} catch(e) {setError(e.message);return;}
    let finishCache;
    try {finishCache = beginCacheWork();} catch(e) {setError(e.message);return;}
    const controller = new AbortController();
    const current = {controller, jobs:new Set(), gate:createBackgroundGate(AppState.currentState || 'active')};
    const commit = serialQueue();
    const choices = serialQueue();
    operation.current = current;
    setBusy(true);
    const journal = saved ? JSON.parse(JSON.stringify(saved)) : {rows:links.map(url=>({url,status:'En attente'})), expanded:false, input};
    setInput(journal.input || links.join(' ; '));
    const persist = () => writeImportJournal(journal);
    const update = async (i, patch) => {
      journal.rows[i] = {...journal.rows[i],...patch};
      setRows([...journal.rows]);
      await persist();
      const done=journal.rows.filter(r=>!pendingImportRows([r]).length || r.status==='Échec').length;
      await updateBackgroundImport(done,journal.rows.length).catch(()=>{});
    };
    const select = prepared => choices(async () => {
      if(controller.signal.aborted)return null;
      setPhase('Choix YouTube nécessaire · reviens dans Peak Music');
      await current.gate.wait(controller.signal,true);
      setPhase('Choisis la bonne version YouTube');
      const selected = await new Promise(resolve=>{choose.current=resolve;setChoice(prepared);});
      choose.current=null;setChoice(null);
      return selected;
    });
    const skipExisting = async (i,candidate) => {
      const song=await lookup.current(candidate);
      if(!song)return false;
      await update(i,{title:song.title,status:'Déjà présent — ignoré',detail:''});
      return true;
    };
    try {
      await persist();
      const mode=await beginBackgroundImport();
      if(mode==='transfers')setBackgroundMode('Les fichiers directs peuvent continuer écran verrouillé. Les recherches et traitements reprendront au retour dans l’application.');
      else setBackgroundMode('Poursuite de la playlist demandée à iOS. Ne ferme pas l’application depuis le sélecteur.');
      if (!journal.expanded) {
        const expanded=await expandImportLinks(links,controller.signal,setPhase);
        journal.rows=expanded.links.map(url=>({url,status:'En attente'}));
        journal.expanded=true;
        if(expanded.warnings.length)setError(expanded.warnings.join('\n'));
        await persist();
      }
      setRows([...journal.rows]);
      const pending = journal.rows.map((row,i)=>({row,i})).filter(({row})=>onlyFailed ? row.status==='Échec' : pendingImportRows([row]).length);
      await runWorkers(pending, parallel ? 2 : 1, async ({row,i}) => {
        let jobID=row.jobID || `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
        let downloaded;
        let lyricsTask;
        const lyricsController=new AbortController();
        const stop=()=>lyricsController.abort();
        controller.signal.addEventListener('abort',stop);
        try {
          await current.gate.wait(controller.signal);
          await update(i,{jobID,status:'Recherche…',detail:''});
          if(await skipExisting(i,{url:row.url,videoID:row.videoID}))return;
          let prepared=await prepareMusicLink(row.url,controller.signal,setPhase);
          if(controller.signal.aborted)throw Error('Annulé');
          if(await skipExisting(i,prepared))return;
          // Keep only a stable video ID, never a temporary signed download URL.
          if(row.videoID)prepared.videoID=row.videoID;
          if(prepared.candidates?.length && !prepared.videoID) {
            prepared.videoID=await select(prepared);
            if(!prepared.videoID){await update(i,{status:controller.signal.aborted?'En pause':'Ignoré'});return;}
          }
          if(controller.signal.aborted)throw Error('Annulé');
          if(await skipExisting(i,prepared))return;
          await update(i,{videoID:prepared.videoID || null,title:prepared.metadata?.title,status:'Téléchargement…',detail:'Paroles : recherche en parallèle…'});
          lyricsTask=findOnlineLyrics(prepared.metadata,lyricsController.signal).catch(()=>({status:'Paroles indisponibles'}));
          await current.gate.wait(controller.signal);
          current.jobs.add(jobID);
          try {
            downloaded=await downloadPrepared(prepared,jobID,{allowYoutubeThumbnail});
          } catch(e) {
            if(controller.signal.aborted)throw e;
            current.jobs.delete(jobID);
            await current.gate.wait(controller.signal);
            prepared=await youtubeFallback(prepared,controller.signal,setPhase);
            if(!prepared.videoID)prepared.videoID=await select(prepared);
            if(!prepared.videoID){await update(i,{status:controller.signal.aborted?'En pause':'Ignoré'});return;}
            if(controller.signal.aborted)throw Error('Annulé');
            if(await skipExisting(i,prepared))return;
            await update(i,{videoID:prepared.videoID});
            jobID+='-youtube';await update(i,{jobID});current.jobs.add(jobID);
            downloaded=await downloadPrepared(prepared,jobID,{allowYoutubeThumbnail});
          }
          current.jobs.delete(jobID);
          if(controller.signal.aborted)throw Error('Annulé');
          // One normalization + durable library write at a time, including lyrics.
          await current.gate.wait(controller.signal);
          const result=await commit(async()=>{
            if(controller.signal.aborted)throw Error('Annulé');
            const result=await save.current(downloaded);
            downloaded=null;
            return result;
          });
          await update(i,{title:result.song.title,status:result.duplicate?'Déjà dans la bibliothèque':'Ajouté ✓',detail:''});
          if(!result.duplicate && lyricsTask) {
            const lyrics=await lyricsTask;
            if(!controller.signal.aborted) {
              const detail=await commit(()=>attach.current(result.song.id,lyrics));
              await update(i,{detail});
            }
          }
        } catch(e) {
          // An optional lyric/journal error must not relabel an already committed song.
          if(!['Ajouté ✓','Déjà dans la bibliothèque'].includes(journal.rows[i].status)) {
            await update(i,{status:controller.signal.aborted?'En pause':'Échec',detail:controller.signal.aborted?'':readableImportError(e)});
          }
        } finally {
          current.jobs.delete(jobID);
          lyricsController.abort();controller.signal.removeEventListener('abort',stop);
          if(downloaded?.uri)await FileSystem.deleteAsync(downloaded.uri,{idempotent:true}).catch(()=>{});
        }
      },controller.signal);
    } catch(e) { setError(readableImportError(e)); }
    finally {
      try {await persist();} catch(e) {setError('Impossible de mémoriser la file : '+readableImportError(e));}
      setResume(pendingImportRows(journal.rows).length ? journal : null);
      await endBackgroundImport(!controller.signal.aborted && !pendingImportRows(journal.rows).length).catch(()=>{});
      operation.current=null;finishCache();setBusy(false);setChoice(null);setFraction(null);
      const added=journal.rows.filter(r=>r.status==='Ajouté ✓').length;
      const skipped=journal.rows.filter(r=>/Déjà/.test(r.status)).length;
      setPhase(`${added} ajouté(s) · ${skipped} déjà présent(s) ignoré(s).`);
    }
  };

  const retryFailed = () => {
    if (!resume) return;
    const failed = resume.rows.filter(row => row.status === 'Échec');
    if (failed.length) return start(resume,true);
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={() => busy ? cancel() : onClose()}>
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading}>Importer un lien</Text>
        <Pressable disabled={busy} onPress={onClose} accessibilityRole="button" style={styles.button}>
          <Text style={[styles.link, busy && styles.disabled]}>Fermer</Text>
        </Pressable>
      </View>
      <FlatList data={rows} keyExtractor={(row,i)=>`${i}-${row.url}`} initialNumToRender={8} windowSize={5} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}
        renderItem={({item:row})=><View style={styles.card}><Text style={styles.title} numberOfLines={2}>{row.title || row.url}</Text><Text style={row.status === 'Échec' ? styles.error : styles.link}>{row.status}</Text>{!!row.detail && <Text style={styles.hint}>{row.detail}</Text>}</View>}
        ListHeaderComponent={<View style={{gap:14}}>
        <Text style={styles.hint}>YouTube · SoundCloud · Spotify</Text>
        <Text style={styles.hint}>Colle des liens de morceaux, de playlists publiques ou de Likes SoundCloud séparés par des ;. Lance l’import ici, puis tu peux verrouiller l’écran. La poursuite complète dépend du temps accordé par iOS ; la file est conservée en cas d’interruption.</Text>
        <TextInput value={input} onChangeText={setInput} editable={!busy} multiline autoCapitalize="none" autoCorrect={false}
          keyboardType="url" placeholder="https://… ; https://…" placeholderTextColor="#8e88a9" style={styles.input}
          accessibilityLabel="Liens des morceaux" />
        <Text style={styles.small}>Spotify et les morceaux SoundCloud incompatibles sont recherchés sur YouTube. Une correspondance claire est sélectionnée automatiquement. L’audio est conservé en M4A ou MP3 sur cet iPhone. Les paroles sont recherchées en parallèle et associées au morceau lorsqu’une correspondance est trouvée.</Text>
        <Text style={styles.small}>La pochette Spotify ou SoundCloud est récupérée lorsqu’elle est disponible, même si l’audio vient de YouTube.</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <Text style={[styles.hint,{flex:1}]}>Utiliser la miniature YouTube si aucune pochette n’est disponible</Text>
          <Switch value={allowYoutubeThumbnail} onValueChange={setAllowYoutubeThumbnail} disabled={busy} accessibilityLabel="Utiliser les miniatures YouTube en remplacement" />
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text style={[styles.hint,{flex:1}]}>Deux téléchargements simultanés</Text><Switch value={parallel} onValueChange={setParallel} disabled={busy}/></View>
        {!busy && resume?.rows.some(row=>row.status==='Échec') && <Pressable onPress={retryFailed} style={styles.primary}><Text style={styles.primaryText}>Réessayer uniquement les échecs ({resume.rows.filter(row=>row.status==='Échec').length})</Text></Pressable>}
        {!busy && resume && <View style={styles.card}><Text style={styles.hint}>{pendingImportRows(resume.rows).length} morceau(x) à reprendre. Les morceaux terminés sont conservés.</Text><Pressable onPress={()=>start(resume)} style={styles.button}><Text style={styles.link}>Reprendre l’import précédent</Text></Pressable><Pressable onPress={async()=>{try{await writeImportJournal({rows:[],expanded:true});setResume(null);}catch(e){setError(e.message);}}} style={styles.button}><Text style={styles.link}>Oublier la file précédente</Text></Pressable></View>}
        {!!backgroundMode && <Text style={styles.small}>{backgroundMode}</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable disabled={!ready || !available || (!busy && !!resume)} onPress={busy ? cancel : () => start()} accessibilityRole="button" style={styles.primary}>
          <Text style={styles.primaryText}>{busy ? 'Mettre en pause' : resume ? 'Reprends ou oublie la file précédente' : 'Télécharger'}</Text>
        </Pressable>
        {!!phase && <View style={styles.progress}>
          {busy && <ActivityIndicator color="#a995ff" />}
          <Text style={styles.status}>{phase}{fraction !== null ? ` ${Math.round(fraction * 100)} %` : ''}</Text>
        </View>}
        {choice && <View style={styles.card}>
          <Text style={styles.title}>{choice.metadata.artist} — {choice.metadata.title}</Text>
          <Text style={styles.hint}>{choice.matchReason || 'Plusieurs versions possibles : sélectionne celle à importer.'}</Text>
          {choice.candidates.map(candidate => <Pressable key={candidate.id} style={styles.candidate}
            onPress={() => choose.current?.(candidate.id)} accessibilityRole="button">
            <Text style={styles.title}>{candidate.title}</Text>
            <Text style={styles.hint}>{candidate.artist} · {Math.floor(candidate.duration / 60)}:{String(candidate.duration % 60).padStart(2, '0')}</Text>
            {!!candidate.matchReason && <Text style={styles.small}>{candidate.matchReason}</Text>}
          </Pressable>)}
          <Pressable onPress={() => choose.current?.(null)} style={styles.button}><Text style={styles.link}>Ignorer ce morceau</Text></Pressable>
        </View>}
        </View>}
      />
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#090b15' },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 23, fontWeight: '900', color: '#fff', flex: 1 },
  body: { padding: 18, gap: 14, paddingBottom: 40 },
  hint: { color: '#b9b4ce', lineHeight: 21, fontSize: 14 },
  small: { color: '#a19bb7', fontSize: 12, lineHeight: 18 },
  input: { minHeight: 115, padding: 15, textAlignVertical: 'top', borderRadius: 16, borderColor: '#51427b', borderWidth: 1, backgroundColor: '#202237', color: '#fff', fontSize: 16 },
  primary: { backgroundColor: '#6549ef', padding: 16, borderRadius: 15, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  button: { padding: 12, minHeight: 44 },
  link: { color: '#b29dff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  error: { color: '#ff9caa', lineHeight: 21 },
  progress: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  status: { color: '#eee9ff', flex: 1, lineHeight: 21 },
  card: { backgroundColor: '#191b2f', borderRadius: 16, padding: 15, gap: 7 },
  title: { fontSize: 15, color: '#fff', fontWeight: '700', lineHeight: 22 },
  candidate: { paddingVertical: 14, borderBottomColor: '#39334d', borderBottomWidth: 1 }
});
