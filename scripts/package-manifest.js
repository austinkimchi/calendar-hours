/* Public store identity for portable ZIP installs. No private key is needed. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash, createPublicKey } = require('node:crypto');
const oauth = require('../extension/oauth');

const storeId = 'gkhggalcelmdidfdnllmdpaaapjiegig';
function releaseManifest(manifest, publicKey) {
  const der = createPublicKey(publicKey).export({ type: 'spki', format: 'der' });
  const id = createHash('sha256').update(der).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)));
  if (id !== storeId || !oauth.clientIdFor(id)) throw new Error('Package public key does not match the registered store OAuth identity');
  return { ...manifest, key: der.toString('base64') };
}

if (require.main === module) {
  const filename = process.argv[2];
  if (!filename) throw new Error('Pass the staged manifest path');
  const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
  const key = fs.readFileSync(path.join(__dirname, 'store-public-key.pem'), 'utf8');
  fs.writeFileSync(filename, JSON.stringify(releaseManifest(manifest, key), null, 2) + '\n');
}
module.exports = { releaseManifest, storeId };
