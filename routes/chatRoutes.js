const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authenticate = require('../middlewares/authenticate');

// 1:1 chat
router.get('/history', chatController.getChatHistory);
router.get('/users/:id', chatController.getAllUsers);
// router.get('/unseen/:userId', chatController.getUnseenMessages);

// Group chat
router.post('/create-group', authenticate, chatController.createGroup);
router.get('/groups', authenticate, chatController.getUserGroups);

// 🔹 Group messages
router.post('/group/messages', authenticate, chatController.sendGroupMessage);
router.get('/group/messages/:roomId', authenticate, chatController.getGroupMessages);

module.exports = router;
