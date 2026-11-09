const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),babel=require('@babel/core'),generate=require('@babel/generator').default;
const code=babel.transformSync(fs.readFileSync('src/services/lyricsTiming.js','utf8'),{configFile:false,babelrc:false,plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
const m={exports:{}};new Function('module','exports',code)(m,m.exports);
const {validTiming,activeLyric,timedLines}=m.exports;
test('timing ignores blank lines but preserves repeated lines',()=>{
 assert.deepEqual(timedLines('First\n\nFirst\nLast'),['First','First','Last']);
 assert.ok(validTiming({text:'First\n\nFirst',times:[1,3]},'First\n\nFirst'));
});
test('invalid, incomplete, stale and unordered timing rejected',()=>{
 const text='A\nB';
 for(const times of [[1],[2,1],[1,1],[NaN,2],[-1,2]])assert.equal(validTiming({text,times},text),false);
 assert.equal(validTiming({text,times:[1,2]},'Changed'),false);
});
test('highlight follows forward and backward seeks and introduction',()=>{
 assert.equal(activeLyric([5,10,15],0),-1);
 assert.equal(activeLyric([5,10,15],10),1);
 assert.equal(activeLyric([5,10,15],18),2);
 assert.equal(activeLyric([5,10,15],6),0);
});
const ast=babel.parseSync(fs.readFileSync('src/context/MusicContext.js','utf8'),{configFile:false,babelrc:false,parserOpts:{plugins:['jsx']}});
let callback;babel.traverse(ast,{VariableDeclarator(p){if(p.node.id.name==='saveLyricsTiming')callback=p.node.init.arguments[0];}});
test('timing saves on existing song, survives serialization and rolls back disk failure',async()=>{
 for(const fail of [false,true]){
 const old={id:'s',lyricsUri:'lyrics.txt',title:'Original'};
 const songsRef={current:[old]};let saved;
 const fn=new Function('validTiming','FileSystem','songsRef','setSongs','saveLibrary','return '+generate(callback).code)(validTiming,{readAsStringAsync:async()=>'A\nB'},songsRef,()=>{},async s=>{if(fail)throw Error('disk');saved=JSON.parse(JSON.stringify(s));});
 if(fail){await assert.rejects(()=>fn('s',{text:'A\nB',times:[1,2]}));assert.equal(songsRef.current[0],old);}
 else{await fn('s',{text:'A\nB',times:[1,2]});assert.deepEqual(saved[0].lyricsTiming.times,[1,2]);assert.equal(saved[0].title,'Original');}
 }
});
test('changed lyrics rejected before save',async()=>{
 const fn=new Function('validTiming','FileSystem','songsRef','setSongs','saveLibrary','return '+generate(callback).code)(validTiming,{readAsStringAsync:async()=>'Changed'}, {current:[{id:'s',lyricsUri:'l.txt'}]},()=>{},async()=>assert.fail('must not save'));
 await assert.rejects(()=>fn('s',{text:'A\nB',times:[1,2]}),/changé/);
});
