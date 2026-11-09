const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{transformSync}=require('@babel/core');
const m={exports:{}};const code=transformSync(fs.readFileSync('src/services/lyricsAnalysisError.js','utf8'),{configFile:false,babelrc:false,plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]}).code;
new Function('module','exports',code)(m,m.exports);
test('no-speech errors are understandable and preserve existing lyric timing',()=>{
 const message=m.exports.lyricsAnalysisError({message:'UnexpectedException: No speech detected (at ExpoModulesCore/ConcurrentFunctionDefinition.swift:90)'});
 assert.match(message,/Aucune voix/);assert.match(message,/conservés/);assert.doesNotMatch(message,/swift|UnexpectedException/);
});
test('technical wrapper removed without hiding actionable error',()=>{
 assert.equal(m.exports.lyricsAnalysisError({message:'UnexpectedException: Autorise la reconnaissance. (at ExpoModulesCore/ConcurrentFunctionDefinition.swift:90)'}),'Autorise la reconnaissance.');
});
test('no-speech segment handling keeps following absolute timestamps and cancellation checks',()=>{
 const source=fs.readFileSync('modules/peak-import/ios/PeakLyricsModule.swift','utf8');
 assert.match(source,/failure.domain == "kAFAssistantErrorDomain" && failure.code == 1110/);
 assert.match(source,/complete\(\.success\(\[\]\)\)/);
 assert.match(source,/try check\(\)\s+words.append/);
 assert.match(source,/start \+= length/);
 assert.match(source,/offset \+ \$0.timestamp/);
 const ui=fs.readFileSync('src/components/AutoLyricsModal.js','utf8');
 assert.doesNotMatch(ui,/TrackPlayer.pause\(/);
});
