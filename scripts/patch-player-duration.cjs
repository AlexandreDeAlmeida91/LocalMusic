const fs = require('node:fs');
const path = require('node:path');
function patch(source) {
  const before = '    let asset = AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": assetHeaders])';
  const after = `    // Peak Music: parse local timing instead of relying on an estimate.
    var assetOptions: [String: Any] = ["AVURLAssetHTTPHeaderFieldsKey": assetHeaders]
    if url.isFileURL {
      assetOptions[AVURLAssetPreferPreciseDurationAndTimingKey] = true
    }
    let asset = AVURLAsset(url: url, options: assetOptions)`;
  if (source.includes(after)) return source;
  if (source.split(before).length !== 2) throw new Error('RNTP source changed: review the precise-duration patch before building.');
  return source.replace(before, after);
}
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@rntp/player/package.json'), 'utf8'));
  if (pkg.version !== '5.9.2') throw new Error('Review duration patch for RNTP ' + pkg.version);
  const file = path.join(root, 'node_modules/@rntp/player/ios/player/AVPlayerEngine.swift');
  fs.writeFileSync(file, patch(fs.readFileSync(file, 'utf8')));
  console.log('Peak Music: precise local audio timing patch applied.');
}
module.exports = { patch };
