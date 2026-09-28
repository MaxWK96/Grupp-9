const db = require('../config/db');

// wait a bit to make sure tables are created first
setTimeout(function () {

  // add some test users
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

  // add a patient linked to John Doe (user id 4, since he was the 4th one added)
  db.run(`INSERT INTO patients (name, personal_number, user_id) VALUES (?, ?, ?)`,
    ['John Doe', '199001011234', 4]);

  console.log('Seed data added!');

}, 500);