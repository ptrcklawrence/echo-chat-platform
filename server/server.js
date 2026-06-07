const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);

// Dynamic CORS for development and production
const allowedOrigins = [
  "http://localhost:5173", // Local development
  "https://echo-chat-platform.vercel.app", // Your future Vercel URL (add later)
  process.env.FRONTEND_URL, // For Render environment variable
].filter(Boolean);

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    transports: ["websocket", "polling"],
  },
});

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

// Health check endpoint (required for Render)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Echo Server is running!",
    version: "1.0.0",
    websocket: "active",
  });
});

// In-memory storage
const waitingUsers = [];
const activeChats = new Map();
const userChatMap = new Map();
const userTimeouts = new Map();

// Helper functions
const findMatch = (socketId) => {
  if (waitingUsers.length > 0 && waitingUsers[0] !== socketId) {
    const partnerId = waitingUsers.shift();
    const chatId = uuidv4().substring(0, 8);

    activeChats.set(chatId, {
      user1: partnerId,
      user2: socketId,
      startTime: new Date(),
    });

    userChatMap.set(partnerId, chatId);
    userChatMap.set(socketId, chatId);

    io.to(partnerId).emit("matched", { chatId, partnerId: socketId });
    io.to(socketId).emit("matched", { chatId, partnerId });

    console.log(`✅ Matched: ${partnerId} with ${socketId}`);
    return true;
  }

  if (!waitingUsers.includes(socketId)) {
    waitingUsers.push(socketId);
    console.log(`👤 User ${socketId} waiting for match`);
  }
  return false;
};

const disconnectUser = (socketId, isSkip = false) => {
  if (userTimeouts.has(socketId)) {
    clearTimeout(userTimeouts.get(socketId));
    userTimeouts.delete(socketId);
  }

  const chatId = userChatMap.get(socketId);
  if (chatId && activeChats.has(chatId)) {
    const chat = activeChats.get(chatId);
    const partnerId = chat.user1 === socketId ? chat.user2 : chat.user1;

    if (partnerId && io.sockets.sockets.get(partnerId)) {
      io.to(partnerId).emit("partner_disconnected", { isSkip });
      userChatMap.delete(partnerId);
      console.log(`👋 User ${socketId} disconnected from ${partnerId}`);

      if (!isSkip) {
        setTimeout(() => {
          if (
            partnerId &&
            io.sockets.sockets.get(partnerId) &&
            !userChatMap.has(partnerId)
          ) {
            findMatch(partnerId);
          }
        }, 1000);
      }
    }

    activeChats.delete(chatId);
    userChatMap.delete(socketId);
  } else {
    const index = waitingUsers.indexOf(socketId);
    if (index > -1) waitingUsers.splice(index, 1);
  }
};

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);
  console.log(`📊 Online users: ${io.sockets.sockets.size}`);

  // Assign random timezone
  const timezones = [
    "UTC-8",
    "UTC-5",
    "UTC+0",
    "UTC+1",
    "UTC+3",
    "UTC+5:30",
    "UTC+8",
    "UTC+9",
  ];
  socket.timezone = timezones[Math.floor(Math.random() * timezones.length)];

  socket.on("find_partner", () => {
    console.log(`🔍 User ${socket.id} looking for partner`);
    const matched = findMatch(socket.id);
    if (!matched) {
      socket.emit("waiting", { message: "Looking for someone..." });
    }
  });

  socket.on("skip", () => {
    console.log(`⏭️ User ${socket.id} skipped`);
    disconnectUser(socket.id, true);
    setTimeout(() => {
      if (socket.connected && !userChatMap.has(socket.id)) {
        findMatch(socket.id);
      }
    }, 500);
  });

  socket.on("send_message", (data) => {
    const chatId = userChatMap.get(socket.id);
    if (chatId && activeChats.has(chatId)) {
      const chat = activeChats.get(chatId);
      const partnerId = chat.user1 === socket.id ? chat.user2 : chat.user1;

      if (partnerId && io.sockets.sockets.get(partnerId)) {
        io.to(partnerId).emit("receive_message", {
          message: data.message,
          timestamp: new Date(),
          sender: "stranger",
        });
        console.log(`💬 Message from ${socket.id} to ${partnerId}`);

        // Echo effect
        if (data.echoCheck) {
          socket.echoWord = data.message;
          socket.echoTimer = setTimeout(() => {
            socket.echoWord = null;
          }, 2000);

          const partnerSocket = io.sockets.sockets.get(partnerId);
          if (partnerSocket && partnerSocket.echoWord === data.message) {
            io.to(chatId).emit("echo_effect", { word: data.message });
            partnerSocket.echoWord = null;
            socket.echoWord = null;
            console.log(`🎯 Echo effect triggered: "${data.message}"`);
          }
        }
      }
    }
  });

  socket.on("typing", (isTyping) => {
    const chatId = userChatMap.get(socket.id);
    if (chatId && activeChats.has(chatId)) {
      const chat = activeChats.get(chatId);
      const partnerId = chat.user1 === socket.id ? chat.user2 : chat.user1;
      if (partnerId && io.sockets.sockets.get(partnerId)) {
        io.to(partnerId).emit("partner_typing", isTyping);
      }
    }
  });

  socket.on("report_user", () => {
    const chatId = userChatMap.get(socket.id);
    if (chatId && activeChats.has(chatId)) {
      const chat = activeChats.get(chatId);
      const partnerId = chat.user1 === socket.id ? chat.user2 : chat.user1;

      if (partnerId && io.sockets.sockets.get(partnerId)) {
        io.to(partnerId).emit("reported");
        disconnectUser(partnerId);
        console.log(`⚠️ User ${partnerId} reported by ${socket.id}`);
      }
      disconnectUser(socket.id);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
    console.log(`📊 Online users: ${io.sockets.sockets.size}`);
    disconnectUser(socket.id);
  });
});

// Broadcast online users count every second
setInterval(() => {
  const onlineCount = io.sockets.sockets.size;
  io.emit("online_count", { count: onlineCount });
}, 1000);

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Echo server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
