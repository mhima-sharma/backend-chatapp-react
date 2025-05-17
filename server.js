const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { createMessage, markMessagesAsSeen, getUnseenMessageCounts } = require('./models/messageModel');



dotenv.config();
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});


app.use(cors());
app.use(express.json());


// Serve uploaded files statically from /uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/chat', chatRoutes); //chat route
app.use('/api/auth', authRoutes);//auth route
// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// Upload API route to receive files
app.post('/api/auth/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

let users = {}; // userId -> socketId

io.on('connection', (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  socket.on('join-room', ({ userId, roomId }) => {
    users[userId] = socket.id;
    socket.join(roomId);
    socket.join(userId); // Join personal room for notifications
    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on('private-message', async ({ fromUserId, toUserId, roomId, type = 'text', message, file_url = null }) => {
    try {
      // Save message
      await createMessage({
        sender_id: fromUserId,
        receiver_id: toUserId,
        room_id: roomId,
        type,
        message,
        file_url,
      });

      // Send to room
      io.to(roomId).emit('private-message', {
        fromUserId,
        toUserId,
        roomId,
        type,
        message,
        file_url,
        created_at: new Date().toISOString(),
      });

      // Notify receiver with updated unseen count
      const unseenCounts = await getUnseenMessageCounts(toUserId);
      io.to(toUserId.toString()).emit('unseen-messages', unseenCounts);

    } catch (error) {
      console.error('❌ Error saving message:', error);
    }
  });

  socket.on('mark-as-seen', async ({ senderId, receiverId }) => {
    try {
      await markMessagesAsSeen(senderId, receiverId);
      io.to(senderId.toString()).emit('messages-seen', { by: receiverId });

      // Send updated unseen count to receiver
      const unseenCounts = await getUnseenMessageCounts(receiverId);
      io.to(receiverId.toString()).emit('unseen-messages', unseenCounts);
    } catch (err) {
      console.error('❌ Error marking messages as seen:', err);
    }
  });

  socket.on('disconnect', () => {
    for (let [userId, sockId] of Object.entries(users)) {
      if (sockId === socket.id) {
        delete users[userId];
        console.log(`🔴 User ${userId} disconnected`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
