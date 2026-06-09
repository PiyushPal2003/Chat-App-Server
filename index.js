const express = require('express');
require('./connect');
const cors = require('cors');
const router = require('./routes');
const http = require('http');
const mongoose = require('mongoose');
const userdb = require('./models/userschema');
const convoDb = require('./models/conversationSchema');
const chatDb = require('./models/chatschema');
const cookieParser = require('cookie-parser')
const { Server } = require("socket.io");
const {socketAuthenticator} = require('./controller/userAuthController.js');

const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  'http://localhost:5173',
  ...(process.env.CLIENT_URL || '').split(','),
]
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});
app.set("io", io);
io.use((socket, next) => {
  cookieParser()(
    socket.request,
    socket.request.res,
    async (err) => await socketAuthenticator(err, socket, next)
  );
});

app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({extended:true}));


app.get('/', (req,res)=>{
    res.send("Hello from server")
})

app.use('/api', router);


//socket
const userSocketIDs = new Map();
app.set("userSocketIDs", userSocketIDs);

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  const userId = socket.user._id.toString();
  userSocketIDs.set(userId, socket.id);
  console.log("Current User socket IDs are:", userSocketIDs);
  io.emit("USER_CONNECTED", Object.fromEntries(userSocketIDs));

  // socket.on("NEW_USER", (data) => {
  //   console.log("New user event received:", data);
  //   socket.broadcast.emit("NEW_USER", data);
  // });

  socket.on("typing", (data) => {
    socket.broadcast.emit("userTyping", data);
  });
  socket.on("stopTyping", (data) => {
    socket.broadcast.emit("userStopTyping", data);
  });
  socket.on("markSeen", async ({ convoId, messageId }) => {
    try {
      const userId = socket.user._id;
      if (!convoId || !messageId) return;
      if (!mongoose.Types.ObjectId.isValid(convoId) || !mongoose.Types.ObjectId.isValid(messageId)) return;

      const convo = await convoDb.findById(convoId);
      if (!convo) return;
      if (!convo.members.some((memberId) => String(memberId) === String(userId))) return;

      const targetMessage = await chatDb.findOne({
        _id: messageId,
        conversationId: convoId,
      }).select("_id");
      if (!targetMessage) return;

      if (!convo.readState) {
        convo.readState = new Map();
      }
      const existingReadState = convo.readState?.get(String(userId));
      const existingLastSeenId = existingReadState?.lastSeenMessageId;
      if (existingLastSeenId) {
        const hasForwardProgress = await chatDb.exists({
          conversationId: convo._id,
          _id: { $gt: existingLastSeenId, $lte: targetMessage._id },
        });
        if (!hasForwardProgress) return;
      }

      const seenAt = new Date();
      convo.readState.set(String(userId), {
        lastSeenMessageId: targetMessage._id,
        seenAt,
      });
      await convo.save({ validateModifiedOnly: true });

      convo.members.forEach((memberId) => {
        if (String(memberId) === String(userId)) return;
        const memberSocket = userSocketIDs.get(String(memberId));
        if (memberSocket) {
          io.to(memberSocket).emit("messagesSeen", {
            conversationId: convo._id,
            readerId: String(userId),
            lastSeenMessageId: targetMessage._id,
            seenAt,
          });
        }
      });
    } catch (err) {
      console.error("markSeen socket error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (userSocketIDs.get(userId) === socket.id) {
      userSocketIDs.delete(userId);
    }
    console.log("Current User socket IDs are:", userSocketIDs);

    socket.broadcast.emit("USER_DISCONNECTED", Object.fromEntries(userSocketIDs));
  })

});


server.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
})
