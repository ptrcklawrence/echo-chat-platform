const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// In-memory storage
const waitingUsers = [];
const activeChats = new Map();
const userChatMap = new Map();
const userTimeouts = new Map();

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

    return true;
  }

  if (!waitingUsers.includes(socketId)) {
    waitingUsers.push(socketId);
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

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

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
    const matched = findMatch(socket.id);
    if (!matched) {
      socket.emit("waiting", { message: "Looking for someone..." });
    }
  });

  socket.on("skip", () => {
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
      }
      disconnectUser(socket.id);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    disconnectUser(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Echo server running on port ${PORT}`);
});

setInterval(() => {
  const onlineCount = io.sockets.sockets.size;
  io.emit("online_count", { count: onlineCount });
}, 1000);
