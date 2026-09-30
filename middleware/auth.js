const db = require('../config/db');

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    res.status(401).json({ message: 'You must be logged in' });
    return;
  }
  next();
}

function canAccessPatient(session, patientId, callback) {
  if (session.role === 'unauthorized') {
    callback(false);
    return;
  }

  if (session.role === 'patient') {
    db.get(`SELECT id FROM patients WHERE id = ? AND user_id = ?`, [patientId, session.userId], function (err, row) {
      if (err || !row) {
        callback(false);
      } else {
        callback(true);
      }
    });
    return;
  }

  callback(true);
}

module.exports = { requireLogin, canAccessPatient };