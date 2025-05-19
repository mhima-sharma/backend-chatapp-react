const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const {
  createMessage,
  markMessagesAsSeen,
  getUnseenMessageCounts,
} = require('./models/messageModel');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// Upload endpoint
app.post('/api/auth/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

let users = {}; // userId -> socketId mapping

io.on('connection', (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  // Join personal and room channels
  socket.on('join-room', ({ userId, roomId }) => {
    users[userId] = socket.id;
    socket.join(roomId);
    socket.join(userId); // personal room for notifications
    console.log(`User ${userId} joined room ${roomId}`);
  });

  // Handle private message
  socket.on(
    'private-message',
    async ({ fromUserId, toUserId, roomId, type = 'text', message, file_url = null }) => {
      try {
        console.log(fromUserId,"fromUserId__one to one")
        await createMessage({
          sender_id: fromUserId,
          receiver_id: toUserId,
          room_id: roomId,
          message,
          type,
          file_url,
          is_group: false,
        });

        // Notify receiver
        io.to(toUserId.toString()).emit('new-private-message', {
          fromUserId,
          roomId,
          message,
          type,
          file_url,
        });

        // Update unseen message count
        const unseenCounts = await getUnseenMessageCounts(toUserId);
        io.to(toUserId.toString()).emit('unseen-messages', unseenCounts);
      } catch (error) {
        console.error('❌ Error saving private message:', error);
      }
    }
  );

  // Handle group message
 socket.on(
  'group-message',
  async ({ fromUserId, roomId, message, type = 'text', file_url = null }) => {
    try {
         console.log(fromUserId,"fromUserId")
      await createMessage({
        sender_id: fromUserId,
        receiver_id: null,   // Group message
        room_id: roomId,     // 🔴 Use roomId here
        message,
        type,
        file_url,
        is_group: true,
      });

      // Emit to all others in the room
      socket.to(roomId).emit('group-message', {
        fromUserId,
        roomId,
        message,
        type,
        file_url,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('❌ Error saving group message:', error);
    }
  }
);

  // Disconnect
  socket.on('disconnect', () => {
    for (const [userId, sockId] of Object.entries(users)) {
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
