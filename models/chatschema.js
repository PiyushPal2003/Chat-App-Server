const mongoose = require("mongoose");

const chat_data = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "conversations",
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user_details",
    required: true,
  },
  receiverId: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "user_details",
    required: true,
  }],
  message: {
    text: { type: String, default: "" },
    url: [{ type: String, default: "" }],
  },
  timestamp: { type: Date, default: Date.now },
});

const chatdb = new mongoose.model("chat", chat_data);
module.exports = chatdb;