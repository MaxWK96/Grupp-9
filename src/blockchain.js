const crypto = require('crypto');

// Skapar ett publikt och ett privat nyckelpar. Privata nyckeln signerar,
// publika nyckeln används för att kolla att signaturen stämmer.
function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

// Gör om vilken data som helst till en hash (ett unikt "fingeravtryck").
function hash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
// Merkletree
function buildMerkleRoot(entries) {
  let hashes = [];
  for (let i = 0; i < entries.length; i++) {
    hashes.push(hash(entries[i]));
  }

  while (hashes.length > 1) {
    let nextLevel = [];
    for (let i = 0; i < hashes.length; i += 2) {
      let left = hashes[i];
      let right = hashes[i + 1] || left; // dubbla sista om udda antal
      nextLevel.push(hash(left + right));
    }
    hashes = nextLevel;
  }

  return hashes[0] || hash('empty');
}

module.exports = { generateKeyPair, hash, buildMerkleRoot };