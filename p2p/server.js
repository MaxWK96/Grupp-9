const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('node:path');
const P2P = require('./p2p');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const p2p = new P2P();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const serverInfo = server.listen(0, async () => {
  const baseUrl = `http://localhost:${server.address().port}/`;
  await p2p.registerListener(baseUrl+'p2p');

  const listeners = await p2p.getListeners();
  console.log(`Server is listening on ${baseUrl}. Network has ${listeners.length} listeners.`);
});

app.get('/', async (req, res) => {    
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  
  app.post('/p2p', async (req, res) => {
    console.log('Received message:', req.body);
    broadcastToBrowsers(req.body);
    res.sendStatus(200);
  });



  const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('message', (msg) => {
    p2p.broadcast(JSON.parse(msg), true);
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcastToBrowsers(message) {
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}



