const express = require('express');
require('dotenv').config();
const session = require('express-session');
const db = require('./config/db');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const noteRoutes = require('./routes/notes');
const chainRoutes = require('./routes/chain');
const realtime = require('./src/realtime');

const app = express();
app.use(express.json());

app.use(session({
  name: 'session_' + (process.env.PORT || 3001),
  secret: 'somesecretkey123',
  resave: false,
  saveUninitialized: false
}));

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/chain', chainRoutes);

app.use(express.static('public'));

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// WebSocket på samma port som Express, så GUI:t kan få realtidsuppdateringar.
realtime.attach(server);