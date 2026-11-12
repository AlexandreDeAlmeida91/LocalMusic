const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
function load(file,mocks={}) {
  const code=transformSync(fs.readFileSync('src/services/'+file+'.js','utf8'),{configFile:false,babelrc:false,plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
  const m={exports:{}};
  new Function('require','module','exports',code)(name=>{if(!(name in mocks))throw Error(name);return mocks[name];},m,m.exports);
  return m.exports;
}
const queue=load('workQueue');
const wait=()=>new Promise(resolve=>setTimeout(resolve,5));
test('two downloads overlap but commits read fresh state one by one',async()=>{
  const serial=queue.serialQueue();let active=0,peak=0,commits=0,peakCommits=0,songs=[];
  await queue.runWorkers([1,2,3,4],2,async id=>{
    peak=Math.max(peak,++active);await wait();active--;
    await serial(async()=>{peakCommits=Math.max(peakCommits,++commits);const current=[...songs];await wait();songs=[...current,id];commits--;});
  });
  assert.equal(peak,2);assert.equal(peakCommits,1);assert.equal(new Set(songs).size,4);
});
test('pause stops new jobs and waits for in-flight cleanup even after a rejection',async()=>{
  const c=new AbortController();let finished=false,started=[];
  await assert.rejects(queue.runWorkers([1,2,3],2,async id=>{started.push(id);if(id===1){await wait();c.abort();throw Error('disk');}await wait();await wait();finished=true;},c.signal));
  assert.equal(finished,true);assert.deepEqual(started,[1,2]);
});
test('serial queue recovers from a failed save',async()=>{
  const serial=queue.serialQueue();await assert.rejects(serial(()=>Promise.reject(Error('disk'))));assert.equal(await serial(()=>42),42);
});
function storageMock(){
  const files=new Map();return {files,ROOT_DIR:'doc/',ensureDirectories:async()=>{},readJsonWithBackup:async(p,f)=>files.has(p)?JSON.parse(files.get(p)):f,writeJsonAtomic:async(p,v)=>{await wait();files.set(p,JSON.stringify(v));}};
}
test('journal snapshots survive restart with selected IDs and only pending rows resume',async()=>{
  const storage=storageMock();const mocks={'./storage':storage,'./workQueue':queue};const journal=load('importJournal',mocks);
  const data={expanded:true,rows:[{url:'a',status:'Ajouté ✓'},{url:'b',status:'Téléchargement…',videoID:'abcdefghijk'},{url:'c',status:'Ignoré'},{url:'d',status:'Échec'}]};
  const first=journal.writeImportJournal(data);data.rows[1].status='En pause';const second=journal.writeImportJournal(data);await Promise.all([first,second]);
  const restored=await load('importJournal',mocks).readImportJournal();
  assert.deepEqual(queue.pendingImportRows(restored.rows).map(r=>r.url),['b','d']);assert.equal(restored.rows[1].videoID,'abcdefghijk');assert.equal(restored.rows[1].status,'En pause');
});
test('simultaneous preference changes do not replace unrelated preferences',async()=>{
  const storage=storageMock();const prefs=load('preferences',{'./storage':storage,'./workQueue':queue});
  await Promise.all([prefs.updatePreferences({songOrder:'newest'}),prefs.updatePreferences({allowYoutubeThumbnail:true})]);
  assert.deepEqual(await prefs.readPreferences(),{songOrder:'newest',allowYoutubeThumbnail:true});
});
test('cache cleanup refuses active work and never deletes durable music',async()=>{
  const removed=[];const fake={cacheDirectory:'cache/',getInfoAsync:async()=>({exists:false}),deleteAsync:async p=>removed.push(p)};
  const cache=load('cacheStorage',{'expo':{requireOptionalNativeModule:()=>null},'expo-file-system/legacy':fake,'./storage':{ROOT_DIR:'doc/',ARTWORK_DIR:'doc/Artwork/'}});
  const end=cache.beginCacheWork();await assert.rejects(cache.clearAppCache());end();end();await cache.clearAppCache();
  assert.deepEqual(removed,['cache/PeakCache/','cache/PeakImports/']);
});
test('startup cleans only abandoned import cache and named artwork temporary files',async()=>{
  const removed=[];const fake={cacheDirectory:'cache/',getInfoAsync:async()=>({exists:true}),readDirectoryAsync:async()=>['id-online.tmp','cover.jpg','library.json.tmp'],deleteAsync:async p=>removed.push(p)};
  const cache=load('cacheStorage',{'expo':{requireOptionalNativeModule:()=>null},'expo-file-system/legacy':fake,'./storage':{ROOT_DIR:'doc/',ARTWORK_DIR:'doc/Artwork/'}});
  await Promise.all([cache.cleanupStartup(),cache.cleanupStartup()]);
  assert.deepEqual(removed,['cache/PeakImports/','doc/Artwork/id-online.tmp']);
});
test('lyrics misses persist, manual refresh bypasses cache, cancelled and failed searches do not cache',async()=>{
  let calls=0;let result={status:'Paroles introuvables'};
  const storage=storageMock();const service=load('cachedLyrics',{
    './storage':storage,'./workQueue':queue,'./cacheStorage':{CACHE_DIR:'cache/',beginCacheWork:()=>()=>{}},
    './onlineLyrics':{lyricIdentity:v=>v,key:v=>v,findOnlineLyrics:async()=>{calls++;return result;},searchLyricsChoices:async()=>[]}
  });
  const q={artist:'fixture',title:'synthetic'};
  await service.findOnlineLyrics(q);await service.findOnlineLyrics(q);assert.equal(calls,1);
  result={text:'Synthetic fixture words only',status:'Paroles disponibles'};
  assert.equal((await service.findOnlineLyrics(q,null,true)).text,result.text);assert.equal(calls,2);
  const c=new AbortController();c.abort();await assert.rejects(service.findOnlineLyrics(q,c.signal));assert.equal(calls,2);
  result={status:'Services de paroles indisponibles'};
  await service.findOnlineLyrics({...q,title:'other'});await service.findOnlineLyrics({...q,title:'other'});assert.equal(calls,4);
});

const gateModule=load('backgroundGate');
test('locked screen waits without runtime, continued grant releases processing but not UI choices',async()=>{
 const gate=gateModule.createBackgroundGate('background');let processing=false,choice=false;
 const c=new AbortController();
 const p=gate.wait(c.signal).then(()=>processing=true);
 const q=gate.wait(c.signal,true).then(()=>choice=true);
 await wait();assert.equal(processing,false);
 gate.setGranted(true);await p;assert.equal(processing,true);assert.equal(choice,false);
 gate.setState('active');await q;assert.equal(choice,true);
});
test('pause cancels a background wait without polling or resuming work',async()=>{
 const gate=gateModule.createBackgroundGate('background');const c=new AbortController();
 const pending=gate.wait(c.signal);c.abort();await assert.rejects(pending,/Annulé/);
});
