const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {patch}=require('../scripts/patch-player-playback.cjs');
test('native playback patch accepts the installed source and is repeatable',()=>{const source=fs.readFileSync('node_modules/@rntp/player/ios/player/AudioPlayer.swift','utf8');const once=patch(source);assert.equal(patch(once),once);assert.match(once,/engine.seek\(to: 0\) \{ \[weak self\] finished/);assert.doesNotMatch(once,/now\(\) \+ 0\.032/);});
test('native playback patch fails closed on unknown source',()=>{assert.throws(()=>patch('class Changed {}'),/source changed/);});
