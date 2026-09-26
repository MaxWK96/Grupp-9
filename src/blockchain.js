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

class Block {
  constructor(index, previousHash, logEntries, privateKey, publicKey) {
    this.index = index;
    this.timestamp = Date.now();
    this.previousHash = previousHash;
    this.logEntries = logEntries; // vem som tittade på vad
    this.merkleRoot = buildMerkleRoot(logEntries);
    this.hash = this.calculateHash();
    this.signature = this.sign(privateKey);
    // Blocket bär med sig signerarens publika nyckel så vilken server som helst kan verifiera det sen.
    this.publicKey = publicKey;
  }

  calculateHash() {
    return hash(this.index + this.timestamp + this.previousHash + this.merkleRoot);
  }

  sign(privateKey) {
    const signer = crypto.createSign('SHA256');
    signer.update(this.hash);
    signer.end();
    return signer.sign(privateKey, 'hex');
  }
}


// Kollar om ett blocks signatur fortfarande matchar - "verification badge" i UI:t.
// Använder blockets EGEN publika nyckel, eftersom blocket kan ha skapats
// av ett annat sjukhus med ett annat nyckelpar.
function verifyBlockSignature(block) {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(block.hash);
  verifier.end();
  return verifier.verify(block.publicKey, block.signature, 'hex');
}

class Blockchain {
  constructor(publicKey, privateKey) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.chain = [new Block(0, '0', [{ type: 'genesis' }], privateKey, publicKey)];
  }

  addBlock(logEntries) {
    const previousBlock = this.chain[this.chain.length - 1];
    const newBlock = new Block(this.chain.length, previousBlock.hash, logEntries, this.privateKey, this.publicKey);
    this.chain.push(newBlock);
    return newBlock;
  }

  // Kollar att alla block faktiskt hänger ihop.
  isChainValid(chain) {
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].previousHash !== chain[i - 1].hash) return false;
    }
    return true;
  }

  // "Längsta kedjan vinner" - används av P2P-lagret vid sync mellan sjukhus.
  replaceChain(newChain) {
    if (newChain.length <= this.chain.length) return false;
    if (!this.isChainValid(newChain)) return false;
    this.chain = newChain;
    return true;
  }
}

module.exports = { Blockchain, generateKeyPair, verifyBlockSignature };