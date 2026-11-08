const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {transformSync} = require('@babel/core');
function load(fetch) {
 const code=transformSync(fs.readFileSync('src/services/onlineLyrics.js','utf8'),{configFile:false,babelrc:false,plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
 const m={exports:{}};new Function('module','exports','fetch',code)(m,m.exports,fetch);return m.exports;
}
const response = body => ({ok:true,text:async()=>body});
test('exact artist required, metadata cleaned, no kanji output',()=>{
 const p=load();assert.deepEqual(p.lyricIdentity({title:'Singer - Song (Official Audio)',artist:'Uploader'}),{title:'Song',artist:'Singer'});
 assert.equal(p.exactRecord({trackName:'Song',artistName:'Other'},{title:'Song',artist:'Singer'}),false);
 assert.equal(p.validatedText('これは長いテスト用の歌詞ではありません'),null);
});
test('LRCLIB exact match returns text and source; no second service',async()=>{
 let calls=0;const p=load(async()=>{calls++;return response(JSON.stringify([{id:1,trackName:'Song',artistName:'Singer',plainLyrics:'Synthetic words for testing only.'}]));});
 const r=await p.findOnlineLyrics({title:'Song',artist:'Singer'});assert.equal(r.source,'LRCLIB');assert.equal(calls,1);
});
test('wrong artist never saved and failures are non-blocking',async()=>{
 const p=load(async url=>{if(url.includes('lrclib'))return response(JSON.stringify([{trackName:'Song',artistName:'Other',plainLyrics:'Synthetic unrelated words for tests.'}]));throw Error('offline');});
 const r=await p.findOnlineLyrics({title:'Song',artist:'Singer'});assert.equal(r.text,undefined);
});
test('romaji requires matching page heading and search artist',async()=>{
 const p=load(async url=>response(url.includes('lrclib')?'[]':url.includes('results?')?'<a href="https://www.animesonglyrics.com/test/song">Singer - Song</a>':'<h1>Singer - Song Lyrics</h1><div class="romaji-single-line">Synthetic romanized fixture only.</div>'));
 const r=await p.findOnlineLyrics({title:'Song',artist:'Singer'});assert.match(r.source,/rōmaji/);
});
test('cancellation and missing artist do not write lyrics',async()=>{
 const p=load(async()=>{throw Error('unexpected');});
 assert.equal((await p.findOnlineLyrics({title:'Song'})).text,undefined);
 const c=new AbortController();c.abort();assert.equal((await p.findOnlineLyrics({title:'Song',artist:'Singer'},c.signal)).status,'Recherche interrompue');
});
