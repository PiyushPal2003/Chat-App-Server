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
  mentions: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user_details",
        required: true,
      },
      name: { type: String, required: true },
    },
  ],
  replyTo: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "chat",
      default: null,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user_details",
      default: null,
    },
    text: { type: String, default: "" },
  },
  forwardInfo: {
    isForwarded: { type: Boolean, default: false },
    sourceMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "chat",
      default: null,
    },
    originalSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user_details",
      default: null,
    },
  },
  isEdited: { type: Boolean, default: false },
  deleted: {
    for: [{type: mongoose.Schema.Types.ObjectId, ref: "user_details", default: null}],
    text: { type: String, default: "" },
    //below only for the message owner
    status: {
      type: String,
      enum: ["none", "admin", "everyone"],
      default: "none"
    }
  },
  editedAt: { type: Date, default: null },
  timestamp: { type: Date, default: Date.now },
});

const chatdb = new mongoose.model("chat", chat_data);
module.exports = chatdb;
