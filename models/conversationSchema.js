const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  members: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "user_details",
    required: true,
    validate: {
      validator: function (v) {
        return v.length >= 2;
      },
      message: "A conversation must have at least two member",
    },
  },
  photo: {
    type: String,
    default: "NA",
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user_details",
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
  timestamp: {
    type: Date,
    default: Date.now,
  },
})

conversationSchema.pre('save', function(next){
    if (!this.admin && this.members?.length > 0) {
        this.admin = this.members[0];
    }
    next();
})

const Conversation = mongoose.model("conversation", conversationSchema);
module.exports = Conversation;