const express = require('express');
const router = express.Router();
const db = require('../config/db');

const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
// get api 
router.get("/users/:id", authController.getAllUsersExceptMe);

router.get("/messages/:roomId", (req, res) => {
  const { roomId } = req.params;

  const query = `
    SELECT sender_id AS sender, message AS text 
    FROM messages 
    WHERE room_id = ? 
    ORDER BY created_at ASC
  `;

  db.query(query, [roomId], (err, results) => {
    if (err) {
      console.error("Error fetching messages:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
    res.json(results);
  });
});

module.exports = router;
