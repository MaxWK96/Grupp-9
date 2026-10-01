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

// Fristående så att den även fungerar på block som kommit in som vanlig JSON från ett annat sjukhus.
function calculateBlockHash(block) {
  return hash(block.index + block.timestamp + block.previousHash + block.merkleRoot);
}

class Block {
  constructor(index, previousHash, logEntries, privateKey, publicKey, timestamp = Date.now()) {
    this.index = index;
    this.timestamp = timestamp;
    this.previousHash = previousHash;
    this.logEntries = logEntries; // vem som tittade på vad
    this.merkleRoot = buildMerkleRoot(logEntries);
    this.hash = this.calculateHash();
    this.signature = this.sign(privateKey);
    // Blocket bär med sig signerarens publika nyckel så vilken server som helst kan verifiera det sen.
    this.publicKey = publicKey;
  }

  calculateHash() {
    return calculateBlockHash(this);
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

// Full kontroll av ett block: räknar om merkle-roten och hashen från innehållet innan signaturen kollas.
// Utan det här skulle någon kunna ändra logEntries men låta hash/signatur vara kvar, och blocket skulle
// fortfarande se "verifierat" ut.
function verifyBlock(block) {
  if (buildMerkleRoot(block.logEntries) !== block.merkleRoot) return false;
  if (calculateBlockHash(block) !== block.hash) return false;
  return verifyBlockSignature(block);
}

class Blockchain {
  constructor(publicKey, privateKey) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.chain = [new Block(0, '0', [{ type: 'genesis' }], privateKey, publicKey, 0)];
    this.listeners = [];
  }

  // Registrera en funktion som körs varje gång kedjan ändras (t.ex. spara till fil, uppdatera GUI, skicka till andra sjukhus).
  onChange(listener) {
    this.listeners.push(listener);
  }

  notifyChange() {
    this.listeners.forEach((listener) => listener(this.chain));
  }

  addBlock(logEntries) {
    const previousBlock = this.chain[this.chain.length - 1];
    const newBlock = new Block(this.chain.length, previousBlock.hash, logEntries, this.privateKey, this.publicKey);
    this.chain.push(newBlock);
    this.notifyChange();
    return newBlock;
  }

  // Kollar att alla block hänger ihop, att inget innehåll ändrats och att signaturerna stämmer.
  isChainValid(chain) {
    if (chain[0].hash !== this.chain[0].hash) return false; // samma genesis som vi
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].previousHash !== chain[i - 1].hash) return false;
      if (!verifyBlock(chain[i])) return false;
    }
    return true;
  }

  // "Längsta kedjan vinner" - används av P2P-lagret vid sync mellan sjukhus.
  // Är kedjorna lika långa vinner den vars sista block har lägst hash, så att alla servrar väljer samma.
  // Block som bara fanns i vår egen kedja (t.ex. två sjukhus loggade samtidigt) kastas inte bort:
  // deras loggposter läggs i ett nytt block ovanpå den vinnande kedjan, så ingen åtkomst försvinner ur loggen.
  // Returnerar true om kedjan byttes ut.
  replaceChain(newChain) {
    const ourLast = this.chain[this.chain.length - 1];
    const theirLast = newChain[newChain.length - 1];
    const isLonger = newChain.length > this.chain.length;
    const winsTie = newChain.length === this.chain.length && theirLast.hash < ourLast.hash;
    if (!isLonger && !winsTie) return false;
    if (!this.isChainValid(newChain)) return false;

    const theirHashes = new Set(newChain.map((block) => block.hash));
    const orphanedEntries = [];
    this.chain.forEach((block) => {
      if (!theirHashes.has(block.hash)) orphanedEntries.push(...block.logEntries);
    });

    this.chain = newChain;
    if (orphanedEntries.length > 0) {
      this.addBlock(orphanedEntries); // anropar notifyChange själv
    } else {
      this.notifyChange();
    }
    return true;
  }
}

module.exports = { Blockchain, generateKeyPair, verifyBlockSignature, verifyBlock };