const { WebSocketServer } = require('ws');

// Skickar händelser till alla webbläsare som är anslutna till DENNA server via WebSocket.
// Meddelanden ser ut så här: { type: 'note-added' | 'chain-updated', patientId }
let wss = null;

function attach(server) {
  wss = new WebSocketServer({ server });
}

function broadcast(message) {
  if (!wss) return;
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(data);
    }
  }
}

module.exports = { attach, broadcast };
