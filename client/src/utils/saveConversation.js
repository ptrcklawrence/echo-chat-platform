export const saveConversation = (messages, chatId) => {
  const startTime = messages[0]?.timestamp || new Date();
  const endTime = new Date();
  const chatIdDisplay =
    chatId || `Echo-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  let conversationText = `ECHO CONVERSATION SAVE\n`;
  conversationText += `========================\n`;
  conversationText += `Chat ID: ${chatIdDisplay}\n`;
  conversationText += `Started: ${new Date(startTime).toLocaleString()}\n`;
  conversationText += `Ended: ${endTime.toLocaleString()}\n`;
  conversationText += `Total Messages: ${messages.length}\n`;
  conversationText += `========================\n\n`;

  messages.forEach((message, index) => {
    const speaker = message.sender === "you" ? "You" : "Stranger";
    const time = new Date(message.timestamp).toLocaleTimeString();
    conversationText += `[${time}] ${speaker}: ${message.text}\n`;
  });

  conversationText += `\n========================\n`;
  conversationText += `Saved on: ${new Date().toLocaleString()}\n`;
  conversationText += `Thank you for using Echo! 🌍\n`;

  const blob = new Blob([conversationText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `echo-chat-${chatIdDisplay}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
