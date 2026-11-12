const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {transformSync}=require('@babel/core');
const source=transformSync(fs.readFileSync('src/services/songSort.js','utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
const m={exports:{}};new Function('exports',source)(m.exports);const {sortSongs}=m.exports;
const songs=[{id:'a',title:'Alpha',addedAt:'2026-11-01T12:00:00Z'},{id:'b',title:'Beta',addedAt:'2026-11-12T12:00:00Z'},{id:'c',title:'Charlie'}];
test('date sorting handles both directions, keeps undated songs last and preserves input',()=>{
 assert.deepEqual(sortSongs(songs,'newest').map(s=>s.id),['b','a','c']);
 assert.deepEqual(sortSongs(songs,'oldest').map(s=>s.id),['a','b','c']);
 assert.deepEqual(songs.map(s=>s.id),['a','b','c']);
});
test('alphabetical sorting and same-date ties remain deterministic',()=>{
 assert.deepEqual(sortSongs([...songs].reverse()).map(s=>s.id),['a','b','c']);
 assert.deepEqual(sortSongs([{title:'Z',addedAt:'2026-01-01'},{title:'A',addedAt:'2026-01-01'}],'newest').map(s=>s.title),['A','Z']);
});
