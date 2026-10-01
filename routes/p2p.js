const express = require('express');
const chain = require('../src/chain');
const router = express.Router();
const realtime = require('../src/realtime');


router.post('/broadcast', function (req, res) {
  const msg  = req.body;
  if(msg.type == 'chain-updated') {
    const newChain = msg.chain;
    const replaced = chain.replaceChain(newChain);
    realtime.broadcast({ type: 'chain-updated'});
    console.log('Received new chain from peer. Replaced local chain: ' + replaced);    
    
  }
  if(msg.type == 'note-added') {
    console.log('Recieved note-added broadcast from peer for patientId: ' + msg.patientId);
    realtime.broadcast(msg);
  }
  res.json({ message: 'Broadcast sent' });
});


module.exports = router;