const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {transformSync}=require('@babel/core');
function compile(path,jsx=false){return transformSync(fs.readFileSync(path,'utf8'),{configFile:false,babelrc:false,plugins:[...(jsx?[require.resolve('@babel/plugin-transform-react-jsx')]:[]),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;}
function evaluate(code,mocks){const m={exports:{}};new Function('require','module','exports',code)(n=>{if(!(n in mocks))throw Error(n);return mocks[n];},m,m.exports);return m.exports;}
const queue=evaluate(compile('src/services/workQueue.js'),{});
const delay=()=>new Promise(r=>setTimeout(r,5));
test('import UI runs two workers, persists completion, skips existing songs and resumes interrupted rows',async()=>{
  let slots=[],cursor=0,effects=[],mounted=false,tree,stored;
  let stateCallback, cancelled=0, locked=false;
  let active=0,peak=0,saveActive=0,savePeak=0,prepares=[],saved=[];
  const React={createElement:(type,props,...children)=>({type,props:props||{},children}),
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
    useRef(initial){const i=cursor++;return slots[i] ||= {current:initial};},
    useEffect(fn){cursor++;if(!mounted)effects.push(fn);}};
  const native={StyleSheet:{create:v=>v},AppState:{currentState:'active',addEventListener:(_,fn)=>{stateCallback=fn;return {remove(){}};}}};
  for(const name of ['ActivityIndicator','Modal','Pressable','SafeAreaView','FlatList','Text','TextInput','View','Switch'])native[name]=name;
  const initial={version:1,expanded:true,input:'fixture',rows:[{url:'done',status:'Ajouté ✓'},{url:'exists',status:'En attente'},{url:'a',status:'Téléchargement…'},{url:'b',status:'En attente'}]};
  const Component=evaluate(compile('src/components/LinkImportModal.js',true),{
    react:React,'react-native':native,'expo-file-system/legacy':{deleteAsync:async()=>{}},
    '../hooks/usePreference':{default:()=>[true,()=>{}],__esModule:true},
    '../services/workQueue':queue,
    '../services/backgroundGate':evaluate(compile('src/services/backgroundGate.js'),{}),
    '../services/importJournal':{readImportJournal:async()=>initial,writeImportJournal:async v=>{stored=JSON.parse(JSON.stringify(v));}},
    '../services/cacheStorage':{beginCacheWork:()=>()=>{},cleanupStartup:async()=>{}},
    '../services/cachedLyrics':{findOnlineLyrics:async()=>({status:'Paroles introuvables'})},
    '../services/linkParsing':{readableImportError:e=>e.message},
    '../services/linkImport':{beginBackgroundImport:async()=> 'transfers',updateBackgroundImport:async()=>{},endBackgroundImport:async()=>{},subscribeBackgroundImport:()=>({remove(){}}),assertImportEngine(){},subscribeImportProgress:()=>({remove(){}}),cancelNativeImport:async()=>{cancelled++;},
      expandImportLinks:async()=>{throw Error('should not expand resumed playlist');},
      prepareMusicLink:async url=>{prepares.push(url);return {url,videoID:'abcdefghijk',metadata:{title:url}};},
      downloadPrepared:async p=>{peak=Math.max(peak,++active);if(active===2){locked=true;stateCallback('background');setTimeout(()=>{locked=false;stateCallback('active');},30);}await delay();active--;return {uri:p.url,title:p.url};}}
  }).default;
  const props={visible:true,onClose(){},onFindExisting:async p=>p.url==='exists'?{title:'existing'}:null,
    onImported:async d=>{assert.equal(locked,false,'without a processing grant, commit waits for foreground');savePeak=Math.max(savePeak,++saveActive);await delay();saved.push(d.title);saveActive--;return {song:{id:d.title,title:d.title}};},onLyrics:async()=> 'Paroles introuvables'};
  function render(){cursor=0;tree=Component(props);mounted=true;}
  function findButton(node,label){if(!node||typeof node!=='object')return null;
    const all=[...(node.children||[]).flat(Infinity),node.props?.ListHeaderComponent];
    if(node.type==='Pressable'&&JSON.stringify(node.children).includes(label))return node;
    for(const child of all){const found=findButton(child,label);if(found)return found;}return null;}
  render();effects.forEach(fn=>fn());await delay();render();
  await findButton(tree,'Reprendre l’import précédent').props.onPress();
  assert.deepEqual(prepares.sort(),['a','b']);assert.deepEqual(saved.sort(),['a','b']);assert.equal(peak,2);assert.equal(savePeak,1);assert.equal(cancelled,0,'locking must not cancel direct downloads');
  assert.equal(queue.pendingImportRows(stored.rows).length,0);
  assert.equal(stored.rows[1].status,'Déjà présent — ignoré');
});

test('failed-only retry preserves paused and completed rows: import UI runs two workers, persists completion, skips existing songs and resumes interrupted rows',async()=>{
  let slots=[],cursor=0,effects=[],mounted=false,tree,stored;
  let stateCallback, cancelled=0, locked=false;
  let active=0,peak=0,saveActive=0,savePeak=0,prepares=[],saved=[];
  const React={createElement:(type,props,...children)=>({type,props:props||{},children}),
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
    useRef(initial){const i=cursor++;return slots[i] ||= {current:initial};},
    useEffect(fn){cursor++;if(!mounted)effects.push(fn);}};
  const native={StyleSheet:{create:v=>v},AppState:{currentState:'active',addEventListener:(_,fn)=>{stateCallback=fn;return {remove(){}};}}};
  for(const name of ['ActivityIndicator','Modal','Pressable','SafeAreaView','FlatList','Text','TextInput','View','Switch'])native[name]=name;
  const initial={version:1,expanded:true,input:'fixture',rows:[{url:'done',status:'Ajouté ✓'},{url:'paused',status:'En pause'},{url:'a',status:'Échec'},{url:'b',status:'Échec'}]};
  const Component=evaluate(compile('src/components/LinkImportModal.js',true),{
    react:React,'react-native':native,'expo-file-system/legacy':{deleteAsync:async()=>{}},
    '../hooks/usePreference':{default:()=>[true,()=>{}],__esModule:true},
    '../services/workQueue':queue,
    '../services/backgroundGate':evaluate(compile('src/services/backgroundGate.js'),{}),
    '../services/importJournal':{readImportJournal:async()=>initial,writeImportJournal:async v=>{stored=JSON.parse(JSON.stringify(v));}},
    '../services/cacheStorage':{beginCacheWork:()=>()=>{},cleanupStartup:async()=>{}},
    '../services/cachedLyrics':{findOnlineLyrics:async()=>({status:'Paroles introuvables'})},
    '../services/linkParsing':{readableImportError:e=>e.message},
    '../services/linkImport':{beginBackgroundImport:async()=> 'transfers',updateBackgroundImport:async()=>{},endBackgroundImport:async()=>{},subscribeBackgroundImport:()=>({remove(){}}),assertImportEngine(){},subscribeImportProgress:()=>({remove(){}}),cancelNativeImport:async()=>{cancelled++;},
      expandImportLinks:async()=>{throw Error('should not expand resumed playlist');},
      prepareMusicLink:async url=>{prepares.push(url);return {url,videoID:'abcdefghijk',metadata:{title:url}};},
      downloadPrepared:async p=>{peak=Math.max(peak,++active);if(active===2){locked=true;stateCallback('background');setTimeout(()=>{locked=false;stateCallback('active');},30);}await delay();active--;return {uri:p.url,title:p.url};}}
  }).default;
  const props={visible:true,onClose(){},onFindExisting:async p=>p.url==='exists'?{title:'existing'}:null,
    onImported:async d=>{assert.equal(locked,false,'without a processing grant, commit waits for foreground');savePeak=Math.max(savePeak,++saveActive);await delay();saved.push(d.title);saveActive--;return {song:{id:d.title,title:d.title}};},onLyrics:async()=> 'Paroles introuvables'};
  function render(){cursor=0;tree=Component(props);mounted=true;}
  function findButton(node,label){if(!node||typeof node!=='object')return null;
    const all=[...(node.children||[]).flat(Infinity),node.props?.ListHeaderComponent];
    if(node.type==='Pressable'&&JSON.stringify(node.children).includes(label))return node;
    for(const child of all){const found=findButton(child,label);if(found)return found;}return null;}
  render();effects.forEach(fn=>fn());await delay();render();
  await findButton(tree,'Réessayer uniquement les échecs').props.onPress();
  assert.deepEqual(prepares.sort(),['a','b']);assert.deepEqual(saved.sort(),['a','b']);assert.equal(peak,2);assert.equal(savePeak,1);assert.equal(cancelled,0,'locking must not cancel direct downloads');
  assert.equal(queue.pendingImportRows(stored.rows).length,1);
  assert.equal(stored.rows[1].status,'En pause');
  assert.equal(stored.rows[0].status,'Ajouté ✓');
});
