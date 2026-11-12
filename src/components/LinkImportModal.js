import { findOnlineLyrics } from '../services/onlineLyrics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Switch } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { youtubeFallback, expandImportLinks, assertImportEngine, prepareMusicLink, downloadPrepared, cancelNativeImport, subscribeImportProgress } from '../services/linkImport';
import { readableImportError } from '../services/linkParsing';

export default function LinkImportModal({ visible, onClose, onImported, onFindExisting, onLyrics }) {
  const [allowYoutubeThumbnail, setAllowYoutubeThumbnail] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
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
    if (!current || current.saving) return;
    current.controller.abort();
    choose.current?.(null);
    choose.current = null;
    setChoice(null);
    setPhase('Annulation…');
    cancelNativeImport(current.jobID).catch(() => {});
  };

  useEffect(() => {
    const subscription = subscribeImportProgress(event => {
      if (event.jobID !== operation.current?.jobID || operation.current?.controller.signal.aborted) return;
      setPhase(event.phase);
      setFraction(Number.isFinite(event.fraction) ? event.fraction : null);
    });
    // iOS can suspend foreground work after locking the phone. Cancel cleanly
    // rather than claiming that an unfinished import is available offline.
    const state = AppState.addEventListener('change', value => {
      if (value === 'background' && operation.current && !operation.current.saving) {
        cancel();
        setError('L’import a été interrompu en arrière-plan. Garde Peak Music ouvert pour réessayer.');
      }
    });
    return () => { subscription?.remove(); state.remove(); cancel(); };
  }, []);

  const updateRow = (index, patch) => setRows(current => current.map((row, i) => i === index ? { ...row, ...patch } : row));

  const start = async () => {
    if (operation.current) return;
    setError('');
    let links = [...new Set(input.split(/[;\n\r]+/).map(s => s.trim()).filter(Boolean))];
    if (!links.length || links.length > 20) { setError('Colle entre 1 et 20 liens, séparés par des ; ou des retours à la ligne.'); return; }
    try { assertImportEngine(); } catch (e) { setError(e.message); return; }
    const controller = new AbortController();
    const current = { controller, jobID: '', saving: false };
    operation.current = current;
    setBusy(true);
    setRows(links.map(url => ({ url, status: 'En attente' })));
    let completed = 0, skipped = 0;
    const skipExisting = async (index, candidate) => {
      const song = await lookup.current(candidate);
      if (!song) return false;
      skipped++;
      updateRow(index, { title: song.title, status: 'Déjà présent — ignoré' });
      return true;
    };
    try {
      const expanded = await expandImportLinks(links, controller.signal, setPhase);
      links = expanded.links;
      if (expanded.warnings.length) setError(expanded.warnings.join('\n'));
      setRows(links.map(url => ({ url, status: 'En attente' })));
      for (let i = 0; i < links.length; i++) {
        if (controller.signal.aborted) break;
        current.jobID = `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
        let downloaded;
        let lyricsTask;
        const lyricsController = new AbortController();
        const stopLyrics = () => lyricsController.abort();
        controller.signal.addEventListener('abort', stopLyrics);
        setFraction(null);
        updateRow(i, { status: 'Recherche…' });
        try {
          if (await skipExisting(i, links[i])) continue;
          let prepared = await prepareMusicLink(links[i], controller.signal, setPhase);
          if (controller.signal.aborted) throw new Error('Annulé');
          if (await skipExisting(i, prepared)) continue;
          if (prepared.candidates?.length && !prepared.videoID) {
            setPhase('Choisis la bonne version YouTube');
            const selected = await new Promise(resolve => { choose.current = resolve; setChoice(prepared); });
            choose.current = null;
            setChoice(null);
            if (!selected) {
              updateRow(i, { status: controller.signal.aborted ? 'Annulé' : 'Ignoré' });
              continue;
            }
            prepared.videoID = selected;
          }
          if (controller.signal.aborted) throw new Error('Annulé');
          if (await skipExisting(i, prepared)) continue;
          lyricsTask = findOnlineLyrics(prepared.metadata, lyricsController.signal).catch(() => ({status:'Paroles indisponibles'}));
          updateRow(i, { detail: 'Paroles : recherche en parallèle…', status: 'Téléchargement…', title: prepared.metadata?.title });
          try {
            downloaded = await downloadPrepared(prepared, current.jobID, {allowYoutubeThumbnail});
          } catch (directError) {
            if (controller.signal.aborted) throw directError;
            prepared = await youtubeFallback(prepared, controller.signal, setPhase);
            if (!prepared.videoID) {
              const selected = await new Promise(resolve => { choose.current = resolve; setChoice(prepared); });
              choose.current = null;
              setChoice(null);
              if (!selected) { updateRow(i, { status: 'Ignoré' }); continue; }
              prepared.videoID = selected;
            }
            if (controller.signal.aborted) throw new Error('Annulé');
            if (await skipExisting(i, prepared)) continue;
            // A fresh job ID prevents cancellation bookkeeping from affecting retry.
            current.jobID += '-youtube';
            downloaded = await downloadPrepared(prepared, current.jobID, {allowYoutubeThumbnail});
          }
          if (controller.signal.aborted) throw new Error('Annulé');
          current.saving = true;
          setPhase('Ajout à la bibliothèque…');
          const result = await save.current(downloaded);
          downloaded = null;
          current.saving = false;
          updateRow(i, { title: result.song.title, status: result.duplicate ? 'Déjà dans la bibliothèque' : 'Ajouté ✓' });
          if (result.duplicate) skipped++; else completed++;
          if (!result.duplicate && lyricsTask) {
            setPhase('Son ajouté · fin de la recherche des paroles…');
            const lyrics = await lyricsTask;
            if (!controller.signal.aborted) {
              current.saving = true;
              try {
                const status = await attach.current(result.song.id, lyrics);
                updateRow(i, {detail: status});
              } catch {
                updateRow(i, {detail: 'Son ajouté · enregistrement des paroles impossible. Réessaie depuis Paroles.'});
              }
            }
          }
        } catch (e) {
          updateRow(i, { status: controller.signal.aborted ? 'Annulé' : 'Échec', detail: controller.signal.aborted ? '' : readableImportError(e) });
        } finally {
          lyricsController.abort();
          controller.signal.removeEventListener('abort', stopLyrics);
          current.saving = false;
          if (downloaded?.uri) await FileSystem.deleteAsync(downloaded.uri, { idempotent: true }).catch(() => {});
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(readableImportError(e));
        setRows(currentRows => currentRows.map(row => row.status === 'En attente' ? { ...row, status: 'Échec', detail: readableImportError(e) } : row));
      }
    } finally {
      if (controller.signal.aborted) setRows(currentRows => currentRows.map(row => row.status === 'En attente' ? { ...row, status: 'Annulé' } : row));
      operation.current = null;
      setBusy(false);
      setChoice(null);
      setFraction(null);
      setPhase(`${completed} ajouté(s) · ${skipped} déjà présent(s) ignoré(s).`);
    }
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={() => busy ? cancel() : onClose()}>
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.heading}>Importer un lien</Text>
        <Pressable disabled={busy} onPress={onClose} accessibilityRole="button" style={styles.button}>
          <Text style={[styles.link, busy && styles.disabled]}>Fermer</Text>
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text style={styles.hint}>YouTube · SoundCloud · Spotify</Text>
        <Text style={styles.hint}>Colle des liens de morceaux, de playlists publiques ou de Likes SoundCloud séparés par des ;. Garde Peak Music ouvert pendant l’import.</Text>
        <TextInput value={input} onChangeText={setInput} editable={!busy} multiline autoCapitalize="none" autoCorrect={false}
          keyboardType="url" placeholder="https://… ; https://…" placeholderTextColor="#8e88a9" style={styles.input}
          accessibilityLabel="Liens des morceaux" />
        <Text style={styles.small}>Spotify et les morceaux SoundCloud incompatibles sont recherchés sur YouTube. Une correspondance claire est sélectionnée automatiquement. L’audio est conservé en M4A ou MP3 sur cet iPhone. Les paroles sont recherchées en parallèle et associées au morceau lorsqu’une correspondance est trouvée.</Text>
        <Text style={styles.small}>La pochette Spotify ou SoundCloud est récupérée lorsqu’elle est disponible, même si l’audio vient de YouTube.</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <Text style={[styles.hint,{flex:1}]}>Utiliser la miniature YouTube si aucune pochette n’est disponible</Text>
          <Switch value={allowYoutubeThumbnail} onValueChange={setAllowYoutubeThumbnail} disabled={busy} accessibilityLabel="Utiliser les miniatures YouTube en remplacement" />
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={busy ? cancel : start} accessibilityRole="button" style={styles.primary}>
          <Text style={styles.primaryText}>{busy ? 'Annuler l’import' : 'Télécharger'}</Text>
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
          </Pressable>)}
          <Pressable onPress={() => choose.current?.(null)} style={styles.button}><Text style={styles.link}>Ignorer ce morceau</Text></Pressable>
        </View>}
        {rows.map((row, i) => <View key={`${i}-${row.url}`} style={styles.card}>
          <Text style={styles.title} numberOfLines={2}>{row.title || row.url}</Text>
          <Text style={row.status === 'Échec' ? styles.error : styles.link}>{row.status}</Text>
          {!!row.detail && <Text style={styles.hint}>{row.detail}</Text>}
        </View>)}
      </ScrollView>
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
