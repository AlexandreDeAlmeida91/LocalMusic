const test = require('node:test');
const assert = require('node:assert/strict');
const { patch } = require('../scripts/patch-player-duration.cjs');
test('native timing patch is repeatable and rejects unknown upstream source', () => {
  const original = '    let asset = AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": assetHeaders])';
  const result = patch(original);
  assert.match(result, /if url.isFileURL/);
  assert.match(result, /AVURLAssetPreferPreciseDurationAndTimingKey\] = true/);
  assert.equal(patch(result), result);
  assert.throws(() => patch('changed upstream'), /source changed/);
});
