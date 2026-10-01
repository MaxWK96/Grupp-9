const express = require('express');
const router = express.Router();
const chain = require('../src/chain');
const { verifyBlock } = require('../src/blockchain');
const { requireLogin, canAccessPatient } = require('../middleware/auth');

// Hela kedjan med verifiering per block. Bara för personal, eftersom den innehåller alla patienters loggar.
router.get('/', requireLogin, function (req, res) {
  const role = req.session.role;
  if (role !== 'doctor' && role !== 'nurse' && role !== 'clinic') {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  const blocks = chain.chain.map(function (block) {
    return { ...block, verified: verifyBlock(block) };
  });
  res.json(blocks);
});

router.get('/raw',  function (req, res) {  
  res.json(chain.chain);
});


// Åtkomstloggarna för en patient, hämtade ur blockkedjan. Används av GUI:t för ✓/✗-badgen.
// Har medvetet ingen auditLogger, annars skulle varje hämtning skapa ett nytt block.
router.get('/patient/:id', requireLogin, function (req, res) {
  const patientId = Number(req.params.id);
  canAccessPatient(req.session, patientId, function (allowed) {
    if (!allowed) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const logs = [];
    chain.chain.forEach(function (block) {
      const verified = verifyBlock(block);
      block.logEntries.forEach(function (entry) {
        if (entry.patientId === patientId) {
          logs.push({ ...entry, blockIndex: block.index, verified: verified });
        }
      });
    });
    res.json(logs.reverse()); // nyast först
  });
});

// DEMO: simulerar att någon ändrar i loggen för att dölja sin åtkomst (byter namnet i ett block utan
// att räkna om hash/signatur). Används vid redovisningen för att visa att ✗-badgen slår om.
router.post('/tamper/:index', requireLogin, function (req, res) {
  const role = req.session.role;
  if (role !== 'doctor' && role !== 'nurse' && role !== 'clinic') {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  const block = chain.chain[Number(req.params.index)];
  if (!block || block.index === 0) {
    res.status(400).json({ message: 'Invalid block' });
    return;
  }
  block.logEntries[0].userName = 'Okänd';
  chain.notifyChange();
  res.json({ message: `Block #${block.index} tampered` });
});

module.exports = router;
