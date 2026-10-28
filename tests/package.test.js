const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, generateKeyPairSync } = require('node:crypto');
const { releaseManifest, storeId } = require('../scripts/package-manifest');
const oauth = require('../extension/oauth');
const manifest = require('../extension/manifest.json');
const publicKey = fs.readFileSync(path.join(__dirname, '../scripts/store-public-key.pem'), 'utf8');

test('release ZIP identity is portable and registered without changing the development manifest', () => {
  const packaged = releaseManifest(manifest, publicKey);
  const hex = createHash('sha256').update(Buffer.from(packaged.key, 'base64')).digest('hex').slice(0, 32);
  const id = [...hex].map(digit => 'abcdefghijklmnop'[parseInt(digit, 16)]).join('');
  assert.equal(id, storeId);
  assert.ok(oauth.clientIdFor(id));
  assert.equal(manifest.key, undefined);
  assert.deepEqual({ ...packaged, key: undefined }, { ...manifest, key: undefined });
});

test('packaging rejects malformed or unregistered keys before producing an OAuth-broken ZIP', () => {
  assert.throws(() => releaseManifest(manifest, 'not a public key'));
  const wrongKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ type: 'spki', format: 'pem' });
  assert.throws(() => releaseManifest(manifest, wrongKey), /does not match/);
});
