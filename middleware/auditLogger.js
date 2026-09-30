
const db = require('../config/db');

function logAccess(userId, patientId, action) {

  db.run(
    `INSERT INTO access_logs (user_id, patient_id, action) VALUES (?, ?, ?)`,
    [userId, patientId, action],
    function (err) {
      if (err) {
        console.error('Error saving local access log:', err.message);
      } else {
        console.log(`[AuditLog] Logged action "${action}" for user ${userId} on patient ${patientId}`);
      }
    }
  );
}
function auditLogger(action) {
  return function (req, res, next) {
    const userId = req.session ? req.session.userId : null;

    const patientId = req.params.id || req.body.patientId;

    if (userId && patientId) {
      logAccess(userId, patientId, action);
    }

    next();
  };
}

module.exports = { logAccess, auditLogger };