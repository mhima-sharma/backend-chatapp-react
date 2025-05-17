const db = require('../config/db'); // make sure db connection is set

const createMessage = ({ sender_id, receiver_id, room_id, type, message, file_url }) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO messages (sender_id, receiver_id, room_id, type, message, file_url, is_seen) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [sender_id, receiver_id, room_id, type, message, file_url, false], (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

module.exports = { createMessage };
