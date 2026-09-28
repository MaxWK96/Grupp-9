const express = require('express');
require('dotenv').config();
const db = require('./config/db');

const app = express();
app.use(express.json());

app.use(express.static('public'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));