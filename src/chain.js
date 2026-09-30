const fs = require('fs');
const path = require('path');
const { Blockchain, generateKeyPair } = require('./blockchain');
const realtime = require('./realtime');

// En enda kedja per server som alla filer delar (require() ger samma objekt varje gång).
// Kedjan och serverns nyckelpar sparas i data/-mappen, en uppsättning per port, så att två servrar
// (sjukhus) på samma dator inte skriver över varandras filer och så att kedjan överlever en omstart.
const PORT = process.env.PORT || 3001;
const dataDir = path.join(__dirname, '..', 'data');
const keyFile = path.join(dataDir, `keys-${PORT}.json`);
const chainFile = path.join(dataDir, `chain-${PORT}.json`);

fs.mkdirSync(dataDir, { recursive: true });

// Samma nyckelpar varje gång servern startar, annars byter sjukhuset "identitet" vid varje omstart.
let keys;
if (fs.existsSync(keyFile)) {
  keys = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
} else {
  keys = generateKeyPair();
  fs.writeFileSync(keyFile, JSON.stringify(keys));
}

const chain = new Blockchain(keys.publicKey, keys.privateKey);

// Läs in sparad kedja. Den laddas även om den inte är giltig, så att manipulerade block syns som
// "✗ Manipulerad!" i GUI:t i stället för att tyst försvinna.
if (fs.existsSync(chainFile)) {
  const saved = JSON.parse(fs.readFileSync(chainFile, 'utf8'));
  if (saved.length > 0 && saved[0].hash === chain.chain[0].hash) {
    chain.chain = saved;
    console.log(`[Chain] Loaded ${saved.length} blocks from ${path.basename(chainFile)}`);
    if (!chain.isChainValid(saved)) {
      console.warn('[Chain] WARNING: saved chain has been tampered with!');
    }
  }
}

// Vid varje ändring: spara till fil och säg till anslutna webbläsare att ladda om loggarna.
chain.onChange(function (currentChain) {
  fs.writeFileSync(chainFile, JSON.stringify(currentChain, null, 2));
  realtime.broadcast({ type: 'chain-updated' });
});

module.exports = chain;
