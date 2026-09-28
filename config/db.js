const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');


const db = new sqlite3.Database('./database.db', function (err) {
  if (err) {
    console.log('Error opening database:', err.message);
  } else {
    console.log('Connected to the database');
  }
});
const schema = fs.readFileSync('./db/schema.sql').toString();

db.exec(schema, function (err) {
  if (err) {
    console.log('Error creating tables:', err.message);
  } else {
    console.log('Tables are ready');
  }
});

module.exports = db;