// Retire obsolete files when updating by copying a ZIP over an older checkout.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['src/components/AutoLyricsModal.js','src/services/autoLyricsAlignment.js','src/services/lyricsAnalysisError.js','modules/peak-import/ios/PeakLyricsModule.swift','tests/auto-lyrics-alignment.test.cjs','tests/lyrics-analysis-error.test.cjs']) {
 fs.rmSync(path.join(root,file),{force:true});
}
