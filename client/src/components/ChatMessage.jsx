import React from "react";
import { motion } from "framer-motion";

const ChatMessage = ({ message, index }) => {
  const isUser = message.sender === "you";
  const timeAgo = (timestamp) => {
    const now = new Date();
    const diff = Math.floor((now - new Date(timestamp)) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex mb-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[70%] ${isUser ? "chat-bubble-user" : "chat-bubble-stranger"}`}
      >
        <div className="text-xs opacity-70 mb-1">
          {isUser ? "You" : "Stranger"} • {timeAgo(message.timestamp)}
        </div>
        <div className="break-words">{message.text}</div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;
