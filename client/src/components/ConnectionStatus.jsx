import React from "react";
import { motion } from "framer-motion";

const ConnectionStatus = ({ status, partnerTimezone }) => {
  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "#00c853";
      case "searching":
        return "#ffa500";
      default:
        return "#808080";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected!";
      case "searching":
        return "Looking for someone...";
      default:
        return "Not connected";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-4 bg-[#1a1a3e]/30 rounded-xl border border-[#2d2d5e]"
    >
      <div className="flex flex-wrap justify-between items-center">
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="font-semibold">{getStatusText()}</span>
        </div>

        {status === "connected" && partnerTimezone && (
          <div className="flex items-center space-x-2 text-sm">
            <span>🕐</span>
            <span>Stranger's Timezone: {partnerTimezone}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ConnectionStatus;
