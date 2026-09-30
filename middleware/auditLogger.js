
const db = require('../config/db');
const chain = require('../src/chain');

// Lägger varje logghändelse i ett eget signerat block. Kedjan sparar sig själv och
// meddelar anslutna webbläsare (se src/chain.js).
function addToChain(userId, userName, patientId, action) {
  const block = chain.addBlock([{ userId, userName, patientId, action, timestamp: Date.now() }]);
  console.log(`[Chain] Block #${block.index} added for "${action}" on patient ${patientId}`);
}

function logAccess(userId, patientId, action, userName) {
  addToChain(userId, userName, Number(patientId), action);

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
      logAccess(userId, patientId, action, req.session.name);
    }

    next();
  };
}

module.exports = { logAccess, auditLogger };