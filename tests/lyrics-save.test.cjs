const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');
const generate = require('@babel/generator').default;
const source=fs.readFileSync('src/context/MusicContext.js','utf8');
const ast=babel.parseSync(source,{configFile:false,babelrc:false,parserOpts:{plugins:['jsx']}});
let callback;
babel.traverse(ast,{VariableDeclarator(p){if(p.node.id.name==='attachOnlineLyrics')callback=p.node.init.arguments[0];}});
function harness(fail=false, existing=false) {
 const events=[];const songsRef={current:[{id:'song-1',title:'Original',lyricsUri:existing?'manual.txt':null}]};
 const FileSystem={writeAsStringAsync:async(uri,text)=>{events.push(['write',uri,text]);if(fail)throw Error('disk');},deleteAsync:async uri=>events.push(['delete',uri])};
 const attach=new Function('FileSystem','songsRef','ensureDirectories','LYRICS_DIR','resolveLocalPath','saveLibrary','setSongs','validTiming','return '+generate(callback).code)(FileSystem,songsRef,async()=>{},'Lyrics/',p=>'file:///'+p,async s=>events.push(['save',s]),()=>{},()=>false);
 return {attach,events,songsRef};
}
test('FileSystem namespace is imported from Expo legacy before executing save',()=>{
 assert.ok(ast.program.body.some(n=>n.type==='ImportDeclaration'&&n.source.value==='expo-file-system/legacy'&&n.specifiers.some(s=>s.type==='ImportNamespaceSpecifier'&&s.local.name==='FileSystem')));
});
test('lyrics saved and linked to existing song id',async()=>{
 const h=harness();assert.equal(await h.attach('song-1',{text:'Synthetic test words',status:'Paroles disponibles',source:'Test'}),'Paroles disponibles');
 assert.equal(h.events[0][0],'write');assert.match(h.songsRef.current[0].lyricsUri,/song-1-auto-/);assert.equal(h.songsRef.current[0].title,'Original');assert.equal(h.events[1][0],'save');
});
test('write failure cleans temporary text and preserves audio/library',async()=>{
 const h=harness(true);assert.equal(await h.attach('song-1',{text:'Synthetic',status:'ready'}),'Enregistrement des paroles impossible');assert.equal(h.songsRef.current[0].lyricsUri,null);assert.deepEqual(h.events.map(e=>e[0]),['write','delete']);
});
test('existing manual lyrics never overwritten',async()=>{
 const h=harness(false,true);await h.attach('song-1',{text:'Synthetic'});assert.equal(h.events.length,0);assert.equal(h.songsRef.current[0].lyricsUri,'manual.txt');
});
let chosen;
babel.traverse(ast,{VariableDeclarator(p){if(p.node.id.name==='saveChosenLyrics')chosen=p.node.init.arguments[0];}});
function chosenHarness(fail=false, concurrent=false){
 const old={id:'s',title:'Original',lyricsUri:'old.txt',lyricsPath:'Lyrics/old.txt'};
 const songsRef={current:[old]};const deleted=[];
 const fs={writeAsStringAsync:async()=>{if(concurrent)songsRef.current=[];},deleteAsync:async u=>deleted.push(u)};
 const save=new Function('FileSystem','songsRef','ensureDirectories','LYRICS_DIR','resolveLocalPath','saveLibrary','setSongs','deleteLyrics','validTiming','return '+generate(chosen).code)(fs,songsRef,async()=>{},'Lyrics/',s=>s,async()=>{if(fail)throw Error('disk');},()=>{},async u=>deleted.push(u),()=>false);
 return {save,songsRef,deleted,old};
}
test('chosen lyrics replace safely and clear previous persisted path',async()=>{
 const h=chosenHarness();await h.save(h.old,{text:'My words'});
 assert.equal(h.songsRef.current[0].lyricsPath,null);assert.equal(h.songsRef.current[0].title,'Original');
 assert.deepEqual(h.deleted,['old.txt']);
});
test('failed chosen save restores original lyrics',async()=>{
 const h=chosenHarness(true);await assert.rejects(()=>h.save(h.old,{text:'My words'}));
 assert.equal(h.songsRef.current[0],h.old);assert.ok(!h.deleted.includes('old.txt'));
});
test('concurrent deletion cannot resurrect song',async()=>{
 const h=chosenHarness(false,true);await assert.rejects(()=>h.save(h.old,{text:'My words'}));assert.equal(h.songsRef.current.length,0);
});
