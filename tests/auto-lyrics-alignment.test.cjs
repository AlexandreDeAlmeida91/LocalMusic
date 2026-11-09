const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{transformSync}=require('@babel/core');
function load(path,requireFn){
 const code=transformSync(fs.readFileSync(path,'utf8'),{configFile:false,babelrc:false,plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
 const m={exports:{}};new Function('module','exports','require',code)(m,m.exports,requireFn);return m.exports;
}
const timing=load('src/services/lyricsTiming.js');
const {alignLyrics}=load('src/services/autoLyricsAlignment.js',()=>timing);
const segment=(text,start)=>({text,start,end:start+1});
test('alignment yields line starts with repeated chorus and accented text',()=>{
 const text='Étoile brillante\nReviens ici\nÉtoile brillante';
 const r=alignLyrics(text,[segment('étoile',2),segment('brillante',3),segment('reviens',8),segment('ici',9),segment('étoile',14),segment('brillante',15)]);
 assert.deepEqual(r.times,[2,8,14]);assert.equal(r.coverage,1);
});
test('missing verse, wrong words, and absent first word cannot invent timings',()=>{
 assert.throws(()=>alignLyrics('first line\nsecond line',[segment('first line',1)]));
 assert.throws(()=>alignLyrics('first line',[segment('line',3)]));
 assert.throws(()=>alignLyrics('first line',[segment('wrong song',3)]));
});
test('alignment tolerates extra recognized words and rejects clock disorder',()=>{
 assert.deepEqual(alignLyrics('first line',[segment('noise',1),segment('first',3),segment('line',4)]).times,[3]);
 assert.throws(()=>alignLyrics('first line',[segment('first',3),segment('line',1)]));
});
test('LRC repeats, metadata and offset retained; unsynced/ambiguous lines rejected',()=>{
 const t=timing.parseLrc('[ar:Artist]\n[offset:100]\n[00:01.50][00:10.25]First\n[00:05.00]Second');
 assert.deepEqual(t.times,[1.6,5.1,10.35]);assert.equal(t.text,'First\nSecond\nFirst');
 assert.equal(timing.parseLrc('[00:01]First\nNo timestamp'),null);
 assert.equal(timing.parseLrc('[00:01]First\n[00:01]Second'),null);
 assert.equal(timing.parseLrc('[offset:-2000]\n[00:01]First'),null);
});
test('native prototype explicitly refuses network fallback and keeps cancellation and deadline',()=>{
 const native=fs.readFileSync('modules/peak-import/ios/PeakLyricsModule.swift','utf8');
 assert.match(native,/recognizer.supportsOnDeviceRecognition/);
 assert.match(native,/request.requiresOnDeviceRecognition = true/);
 assert.match(native,/90_000_000_000/);
 assert.match(native,/exporter\?\.cancelExport/);
});
