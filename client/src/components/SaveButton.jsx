import React from "react";
import { motion } from "framer-motion";

const SaveButton = ({ onSave, saveStreak }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onSave}
      className="bg-[#00c853] hover:bg-[#00b045] text-white font-semibold py-2 px-6 rounded-full transition-all duration-200 flex items-center space-x-2"
    >
      <span>💾</span>
      <span>Save Conversation</span>
      {saveStreak > 0 && (
        <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">
          🔥 {saveStreak}
        </span>
      )}
    </motion.button>
  );
};

export default SaveButton;
