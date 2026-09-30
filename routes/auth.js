const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/login', function (req, res) {
  const username = req.body.username;
  const password = req.body.password;

  db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], function (err, user) {
    if (err) {
      res.status(500).json({ message: 'Something went wrong' });
      return;
    }

    if (!user) {
      res.status(401).json({ message: 'Wrong username or password' });
      return;
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;

    res.json({ message: 'Login successful', role: user.role, name: user.name });
  });
});

router.post('/logout', function (req, res) {
  req.session.destroy(function () {
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;