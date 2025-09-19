const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  members: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "user_detail",
    required: true,
    validate: {
      validator: function (v) {
        return v.length >= 2;
      },
      message: "A conversation must have at least two member",
    },
  },
  membersKey: {
    type: String,
    unique: true,
  },
  photo: {
    type: String,
    default: "NA",
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user_detail",
    required: function () {
      return this.members && this.members.length > 2;
    },
  },
  grpname: {
    type: String,
    default: 'Welcome to your Group Chat',
    required: function(v){
        return this.members && this.members.length > 2;
    }
  },
  description: {
    type: String,
    default: 'This is you chat',
    required: function () {
      return this.members && this.members.length > 2;
    },
  },
  lastMessage: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
})

conversationSchema.pre("save", function(next) {
  this.members.sort();  // always sorted
  this.membersKey = this.members.join("_");
  if (!this.admin && this.members?.length > 2) {
    this.admin = this.members[0];
  }
  next();
});

// conversationSchema.index({ membersKey: 1 }, { unique: true });

const Conversation = mongoose.model("conversation", conversationSchema);
module.exports = Conversation;