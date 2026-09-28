const db = require('../config/db');

setTimeout(function () {

  db.run(`INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
    ['Dr. Smith', 'drsmith', '1234', 'doctor']);

  db.run(`INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
    ['Nurse Joy', 'nursejoy', '1234', 'nurse']);

  db.run(`INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
    ['City Clinic', 'clinic1', '1234', 'clinic']);

  db.run(`INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
    ['John Doe', 'johndoe', '1234', 'patient']);

  db.run(`INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
    ['Random Guy', 'randomguy', '1234', 'unauthorized']);

  db.run(`INSERT INTO patients (name, personal_number, user_id) VALUES (?, ?, ?)`,
    ['John Doe', '199001011234', 4]);

  console.log('Seed data added!');

}, 500);
