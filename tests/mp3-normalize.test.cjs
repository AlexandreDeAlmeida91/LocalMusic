const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('@babel/core');
const m = { exports: {} };
new Function('module','exports', transformSync(fs.readFileSync('src/services/mp3Normalize.js','utf8'), { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code)(m,m.exports);
const { normalizeMp3 } = m.exports;
function fixture() {
  const b = new Uint8Array(960 * 3 + 128);
  for (const i of [0,960,1920]) b.set([255,251,228,68],i);
  b.set(Buffer.from('Info'),36);
  const v = new DataView(b.buffer);v.setUint32(40,15);v.setUint32(44,2);v.setUint32(48,2880);
  b.set(Buffer.from('Lavc63.14'),156);
  b.set(Buffer.from('TAG'),2880);
  return b;
}
test('normalization preserves every compressed audio frame and removes legacy footer', () => {
  const original = fixture(), snapshot = original.slice();
  const r = normalizeMp3(original,{ title: '日本語 — Test', artist: 'Artist' });
  assert.equal(r.changed,true);
  assert.deepEqual(original,snapshot);
  assert.deepEqual(r.bytes.slice(r.audioStart),original.slice(960,2880));
  assert.equal(r.bytes[3],3);
  assert.equal(r.duration,0.048);
  const repeated=normalizeMp3(r.bytes,{title:'日本語 — Test',artist:'Artist'});
  assert.deepEqual(repeated.bytes,r.bytes);
});
test('malformed lengths, truncated frames and unknown layouts remain untouched', () => {
  for(const input of [new Uint8Array(),fixture().slice(0,2000),new Uint8Array([73,68,51]),Buffer.from('not an mp3')]) assert.equal(normalizeMp3(input).changed,false);
  const wrong=fixture();wrong[47]=3;assert.equal(normalizeMp3(wrong).changed,false);
  const unsupported=fixture();unsupported[156]=65;assert.equal(normalizeMp3(unsupported).changed,false);
});
