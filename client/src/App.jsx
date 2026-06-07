import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker from "emoji-picker-react";
import ChatMessage from "./components/ChatMessage";
import ConnectionStatus from "./components/ConnectionStatus";
import SaveButton from "./components/SaveButton";
import { saveConversation } from "./utils/saveConversation";
import { useSocket } from "./hooks/useSocket";

function App() {
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [partnerTimezone, setPartnerTimezone] = useState(null);
  const [skipCount, setSkipCount] = useState(0);
  const [saveStreak, setSaveStreak] = useState(0);
  const [showMysteryMode, setShowMysteryMode] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [flashEffect, setFlashEffect] = useState(false);
  const [confetti, setConfetti] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL || "https://echo-server-rgfc.onrender.com/";
  const socket = useSocket(SOCKET_URL); // ← Use the variable

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    socket.on("online_count", ({ count }) => {
      setOnlineCount(count);
    });

    socket.on("waiting", () => {
      setStatus("searching");
      setMessages([]);
    });

    socket.on("matched", ({ chatId: newChatId, partnerId }) => {
      setStatus("connected");
      setChatId(newChatId);
      setPartnerTimezone(socket.timezone || "UTC");
      setMessages([]);
      setSkipCount(0);

      if (showMysteryMode) setShowMysteryMode(false);
    });

    socket.on("receive_message", ({ message, timestamp, sender }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: message,
          timestamp: new Date(timestamp),
          sender: sender,
        },
      ]);
    });

    socket.on("partner_disconnected", ({ isSkip }) => {
      setStatus("idle");
      setPartnerTimezone(null);
      if (!isSkip) {
        setTimeout(() => {
          setStatus("searching");
          socket.emit("find_partner");
        }, 1000);
      }
    });

    socket.on("partner_typing", (isTyping) => {
      setPartnerTyping(isTyping);
    });

    socket.on("echo_effect", ({ word }) => {
      setFlashEffect(true);
      setTimeout(() => setFlashEffect(false), 300);
    });

    socket.on("reported", () => {
      alert(
        "You have been reported for inappropriate behavior. Please follow our community guidelines.",
      );
      setStatus("idle");
      setMessages([]);
    });

    return () => {
      socket.off("online_count");
      socket.off("waiting");
      socket.off("matched");
      socket.off("receive_message");
      socket.off("partner_disconnected");
      socket.off("partner_typing");
      socket.off("echo_effect");
      socket.off("reported");
    };
  }, [socket]);

  const startChat = useCallback(() => {
    if (socket) {
      setStatus("searching");
      setMessages([]);
      socket.emit("find_partner");
    }
  }, [socket]);

  const skipChat = useCallback(() => {
    if (socket && status === "connected") {
      socket.emit("skip");
      setStatus("idle");
      setMessages([]);
      setPartnerTimezone(null);

      const newSkipCount = skipCount + 1;
      setSkipCount(newSkipCount);

      if (newSkipCount >= 10 && !showMysteryMode) {
        setShowMysteryMode(true);
        setTimeout(() => {
          alert(
            '🔮 Mystery Mode Unlocked! Click the "Mystery" button for a surprise!',
          );
        }, 100);
      }
    } else if (status === "searching") {
      socket?.emit("skip");
      setStatus("idle");
    }
  }, [socket, status, skipCount, showMysteryMode]);

  const handleSendMessage = useCallback(() => {
    if (inputMessage.trim() && status === "connected" && socket) {
      let messageText = inputMessage;
      messageText = messageText.replace(/:echo:/g, "🔊");

      const messageData = {
        message: messageText,
        echoCheck: true,
      };

      socket.emit("send_message", messageData);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: messageText,
          timestamp: new Date(),
          sender: "you",
        },
      ]);

      setInputMessage("");
    }
  }, [inputMessage, status, socket]);

  const handleTyping = useCallback(
    (e) => {
      setInputMessage(e.target.value);
      if (socket && status === "connected") {
        socket.emit("typing", e.target.value.length > 0);

        clearTimeout(window.typingTimeout);
        window.typingTimeout = setTimeout(() => {
          socket.emit("typing", false);
        }, 1000);
      }
    },
    [socket, status],
  );

  const handleKeyPress = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      } else if (e.key === "Escape") {
        skipChat();
      }
    },
    [handleSendMessage, skipChat],
  );

  const handleSaveConversation = useCallback(() => {
    if (messages.length > 0) {
      saveConversation(messages, chatId);
      const newStreak = saveStreak + 1;
      setSaveStreak(newStreak);

      const confettiParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * window.innerWidth,
        delay: Math.random() * 0.5,
      }));
      setConfetti(confettiParticles);
      setTimeout(() => setConfetti([]), 2000);

      if (newStreak >= 3) {
        setTimeout(() => {
          alert("🏆 Chat Champion! You've saved 3 conversations in a row!");
        }, 100);
      }
    }
  }, [messages, chatId, saveStreak]);

  const handleMysteryMode = useCallback(() => {
    if (showMysteryMode && status === "connected") {
      const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "What do you call a fake noodle? An impasta!",
        "Why did the scarecrow win an award? He was outstanding in his field!",
        "What do you call a bear with no teeth? A gummy bear!",
        "Why don't eggs tell jokes? They'd crack each other up!",
      ];
      const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: `🤖 Mystery Bot: ${randomJoke}`,
          timestamp: new Date(),
          sender: "stranger",
        },
      ]);
    }
  }, [showMysteryMode, status]);

  return (
    <div
      className={`min-h-screen bg-[#0f0f23] ${flashEffect ? "animate-flash" : ""}`}
    >
      <AnimatePresence>
        {confetti.map((particle) => (
          <motion.div
            key={particle.id}
            className="fixed w-2 h-2 bg-[#6c63ff] rounded-full pointer-events-none"
            style={{ left: particle.x, top: -10 }}
            initial={{ y: -10, opacity: 1 }}
            animate={{ y: window.innerHeight + 10, opacity: 0, rotate: 360 }}
            transition={{ duration: 2, delay: particle.delay }}
          />
        ))}
      </AnimatePresence>

      <header className="bg-[#1a1a3e]/50 backdrop-blur-sm border-b border-[#2d2d5e] sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.div
            className="flex items-center space-x-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span className="text-3xl">🔊</span>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#6c63ff] to-[#a05cff] bg-clip-text text-transparent">
              Echo
            </h1>
          </motion.div>

          <motion.div
            className="flex items-center space-x-2 text-sm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span className="text-[#00c853]">●</span>
            <span>Online: {onlineCount}</span>
          </motion.div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <ConnectionStatus status={status} partnerTimezone={partnerTimezone} />

        <div className="bg-[#1a1a3e]/30 rounded-2xl backdrop-blur-sm border border-[#2d2d5e] min-h-[500px] flex flex-col">
          <div className="flex-1 p-6 overflow-y-auto max-h-[500px]">
            {messages.length === 0 && status !== "connected" && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                  <span className="text-6xl mb-4 block">🌍</span>
                </motion.div>
                <p className="text-gray-400">
                  {status === "searching"
                    ? "Looking for someone to talk to..."
                    : 'Click "Start Chat" to meet someone new!'}
                </p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((message, index) => (
                <ChatMessage key={message.id} message={message} index={index} />
              ))}
            </AnimatePresence>

            {partnerTyping && status === "connected" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start mb-2"
              >
                <div className="bg-[#2d2d5e] rounded-2xl rounded-tl-sm px-4 py-2">
                  <span className="text-sm text-gray-400">
                    Stranger is typing...
                  </span>
                  <span className="animate-pulse">...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {status === "connected" && (
            <div className="border-t border-[#2d2d5e] p-4">
              <div className="flex items-end space-x-2">
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute left-2 bottom-2 text-2xl hover:scale-110 transition-transform"
                  >
                    😊
                  </button>
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={handleTyping}
                    onKeyPress={handleKeyPress}
                    placeholder="Type a message... (500 char max)"
                    maxLength={500}
                    className="w-full bg-[#2d2d5e] text-[#e0e0ff] rounded-2xl px-12 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#6c63ff]"
                    rows="2"
                  />

                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute bottom-full mb-2 left-0 z-20"
                      >
                        <EmojiPicker
                          onEmojiClick={(emojiObject) => {
                            setInputMessage((prev) => prev + emojiObject.emoji);
                            setShowEmojiPicker(false);
                            inputRef.current?.focus();
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleSendMessage}
                  className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-full p-3 transition-all transform hover:scale-105 active:scale-95"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          {(status === "idle" || status === "searching") && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startChat}
              className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold py-2 px-6 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center space-x-2"
            >
              <span>🎲</span>
              <span>
                {status === "searching" ? "Searching..." : "Start Chat"}
              </span>
            </motion.button>
          )}

          {status === "connected" && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={skipChat}
              className="bg-[#2d2d5e] hover:bg-[#3d3d6e] text-[#e0e0ff] font-semibold py-2 px-6 rounded-full transition-all duration-200 flex items-center space-x-2 animate-bounce-pulse"
            >
              <span>⏭</span>
              <span>Skip</span>
            </motion.button>
          )}

          {showMysteryMode && status === "connected" && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleMysteryMode}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-full transition-all duration-200"
            >
              <span>🔮 Mystery Mode</span>
            </motion.button>
          )}

          {status === "idle" && messages.length > 0 && (
            <SaveButton
              onSave={handleSaveConversation}
              saveStreak={saveStreak}
            />
          )}

          {status === "connected" && (
            <button
              onClick={() => socket?.emit("report_user")}
              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 font-semibold py-2 px-4 rounded-full transition-all duration-200 text-sm"
            >
              <span>⚠️ Report</span>
            </button>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-gray-500">
          <p>💡 Tip: Press Enter to send, Escape to skip</p>
          {saveStreak > 0 && (
            <p className="mt-1">🔥 Save Streak: {saveStreak}</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
