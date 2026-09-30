const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireLogin, canAccessPatient } = require('../middleware/auth');
const { auditLogger } = require('../middleware/auditLogger');
const realtime = require('../src/realtime');

router.post('/', requireLogin, auditLogger('add_note'), function (req, res) {
  const patientId = req.body.patientId;
  const content = req.body.content;
  const visibility = req.body.visibility;

  if (visibility !== 'private' && visibility !== 'staff' && visibility !== 'everyone') {
    res.status(400).json({ message: 'Invalid visibility' });
    return;
  }

  if (req.session.role !== 'doctor' && req.session.role !== 'nurse' && req.session.role !== 'clinic') {
    res.status(403).json({ message: 'Access denied' });
    return;
  }

  canAccessPatient(req.session, patientId, function (allowed) {
    if (!allowed) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    db.run(`INSERT INTO notes (patient_id, author_id, content, visibility) VALUES (?, ?, ?, ?)`,
      [patientId, req.session.userId, content, visibility], function (err) {
      if (err) {
        res.status(500).json({ message: 'Something went wrong' });
        return;
      }
      realtime.broadcast({ type: 'note-added', patientId: Number(patientId) });
      res.json({ message: 'Note saved' });
    });
  });
});

module.exports = router;