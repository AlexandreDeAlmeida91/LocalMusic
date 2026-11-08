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
 const attach=new Function('FileSystem','songsRef','ensureDirectories','LYRICS_DIR','resolveLocalPath','saveLibrary','setSongs','return '+generate(callback).code)(FileSystem,songsRef,async()=>{},'Lyrics/',p=>'file:///'+p,async s=>events.push(['save',s]),()=>{});
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
