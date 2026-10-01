const express = require('express');
require('dotenv').config();
const session = require('express-session');
const db = require('./config/db');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const noteRoutes = require('./routes/notes');
const chainRoutes = require('./routes/chain');
const p2pRoute = require('./routes/p2p');
const realtime = require('./src/realtime');
const p2p = require('./p2p/p2p');
const chain = require('./src/chain');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || process.argv[2] || 3001;

app.use(session({
  name: 'session_' + PORT,
  secret: 'somesecretkey123',
  resave: false,
  saveUninitialized: false
}));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/chain', chainRoutes);
app.use('/api/p2p', p2pRoute);

app.use(express.static('public'));

chain.onChange(function (currentChain) {
  p2p.broadcast({ type: 'chain-updated', chain: currentChain }, false)
    .catch((error) => console.error('[P2P] Failed to broadcast chain update:', error));
});

async function synchronizeChain() {
  await p2p.registerListener(`http://localhost:${PORT}`);
  const longestChain = await p2p.getLongestChain();
  if (longestChain.length >= chain.chain.length) {
    console.log(`[P2P] Replacing local chain with longer chain from network (${longestChain.length} blocks)`);
    chain.replaceChain(longestChain);
  }
}

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  synchronizeChain().catch((error) => console.error('[P2P] Initial chain sync failed:', error));
});

// WebSocket på samma port som Express, så GUI:t kan få realtidsuppdateringar.
realtime.attach(server);