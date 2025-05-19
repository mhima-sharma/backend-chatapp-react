// const { getMessagesBetweenUsers,  getUnseenMessageCounts } = require('../models/messageModel');
db = require('../config/db');

exports.getChatHistory = async (req, res) => {
  try {
    const { user1, user2 } = req.query;
    const messages = await getMessagesBetweenUsers(user1, user2);
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.params.id;

    // Exclude the currently logged-in user
    const users = await User.find({ _id: { $ne: currentUserId } }).select('-password');

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// exports.getUnseenMessages = async (req, res) => {
//   try {
//     const receiverId = req.params.userId;
//     const unseenCounts = await getUnseenMessageCounts(receiverId);
//     res.status(200).json(unseenCounts);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch unseen message counts' });
//   }
// };
//  from here this is for creating groups 



exports.createGroup = async (req, res) => {
    const { name, members } = req.body; // members = [userId1, userId2,...]
    const creatorId = req.user.id;

    if (!name || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ message: "Name and members required" });
    }

    try {
        // Create group room
        
        const [roomResult] = await db.promise().query(
            "INSERT INTO chat_rooms (name, isGroup) VALUES (?, ?)",
            [name, true]
        );
        const roomId = roomResult.insertId;

        // Add creator + all members
        const allMembers = [creatorId, ...members];
        const values = allMembers.map(userId => [roomId, userId]);
        await db.promise().query(
            "INSERT INTO room_participants (room_id, user_id) VALUES ?",
            [values]
        );

        res.status(201).json({ roomId, message: "Group created successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error creating group" });
    }
};

exports.getUserGroups = async (req, res) => {
    const userId = req.user.id;

    const [groups] = await db.promise().query(
        `SELECT DISTINCT cr.id, cr.name
         FROM chat_rooms cr
         JOIN room_participants rp ON cr.id = rp.room_id
         WHERE rp.user_id = ? AND cr.isGroup = TRUE`,
        [userId]
    );

    res.json(groups);
};
// yha se suru hoti h gadbad 
exports.sendGroupMessage = async (req, res) => {
  try {
    console.log("post data", req.body);
    const { roomId, message, type = "text", file_url = null } = req.body;
    const sender_id = req.user.id;

    if (!roomId || !message) {
      return res.status(400).json({ message: "roomId and message are required" });
    }

    await db.promise().query(
      `INSERT INTO messages (sender_id, room_id, type, message, file_url, is_group) VALUES (?, ?, ?, ?, ?, ?)`,
      [sender_id, roomId, type, message, file_url, true]
    );

    return res.status(201).json({ message: "Message sent" });
  } catch (error) {
    console.error("Error sending group message:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getGroupMessages = async (req, res) => {
    const roomId = req.params.roomId;

    const [messages] = await db.promise().query(
        `SELECT m.*, u.name AS sender
  FROM messages m
  JOIN users u ON m.sender_id = u.id
  WHERE m.room_id = ?
  ORDER BY m.created_at ASC`,
  [roomId] // Make sure roomId is defined earlier
    );

    res.json(messages);
};


