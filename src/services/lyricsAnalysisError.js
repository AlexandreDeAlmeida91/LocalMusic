export function lyricsAnalysisError(error) {
 const message=String(error?.message||'Analyse impossible.');
 if(/no speech detected/i.test(message))return 'Aucune voix reconnue dans le morceau. Le moteur vocal peut ne pas reconnaître le chant. Essaie les paroles synchronisées en ligne ; tes repères existants sont conservés.';
 return message.replace(/^UnexpectedException:\s*/,'').replace(/\s*\(at\s+ExpoModulesCore\/[\s\S]*$/,'').trim();
}
