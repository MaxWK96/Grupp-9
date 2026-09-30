const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireLogin, canAccessPatient } = require('../middleware/auth');

router.get('/search', requireLogin, function (req, res) {
  const role = req.session.role;

  if (role !== 'doctor' && role !== 'nurse' && role !== 'clinic') {
    res.status(403).json({ message: 'Access denied' });
    return;
  }

  const name = req.query.name;

  db.all(`SELECT id, name FROM patients WHERE name LIKE ?`, ['%' + name + '%'], function (err, patients) {
    if (err) {
      res.status(500).json({ message: 'Something went wrong' });
      return;
    }
    res.json(patients);
  });
});

router.get('/me', requireLogin, function (req, res) {
  db.get(`SELECT id, name FROM patients WHERE user_id = ?`, [req.session.userId], function (err, patient) {
    if (err || !patient) {
      res.status(404).json({ message: 'No patient found for this user' });
      return;
    }
    res.json(patient);
  });
});

router.get('/:id', requireLogin, function (req, res) {
  const patientId = req.params.id;

  canAccessPatient(req.session, patientId, function (allowed) {
    if (!allowed) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    db.get(`SELECT * FROM patients WHERE id = ?`, [patientId], function (err, patient) {
      if (err || !patient) {
        res.status(404).json({ message: 'Patient not found' });
        return;
      }

      let notesQuery = '';
      let notesParams = [];

      if (req.session.role === 'patient') {

        notesQuery = `SELECT notes.*, users.name AS author_name FROM notes
                      JOIN users ON notes.author_id = users.id
                      WHERE patient_id = ? AND visibility = 'everyone'`;
        notesParams = [patientId];
      } else {

        notesQuery = `SELECT notes.*, users.name AS author_name FROM notes
                      JOIN users ON notes.author_id = users.id
                      WHERE patient_id = ?
                      AND (visibility = 'everyone' OR visibility = 'staff'
                           OR (visibility = 'private' AND author_id = ?))`;
        notesParams = [patientId, req.session.userId];
      }

      db.all(notesQuery, notesParams, function (err, notes) {
        if (err) {
          res.status(500).json({ message: 'Something went wrong' });
          return;
        }

        db.run(`INSERT INTO access_logs (user_id, patient_id, action) VALUES (?, ?, ?)`,
          [req.session.userId, patientId, 'view']);

        db.all(`SELECT access_logs.*, users.name AS user_name FROM access_logs
                JOIN users ON access_logs.user_id = users.id
                WHERE patient_id = ? ORDER BY access_logs.id DESC`, [patientId], function (err, logs) {
          if (err) {
            res.status(500).json({ message: 'Something went wrong' });
            return;
          }
          res.json({ patient: patient, notes: notes, logs: logs });
        });
      });
    });
  });
});

module.exports = router;