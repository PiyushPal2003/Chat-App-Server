const express = require('express');
require('./connect');
const cors = require('cors');
const router = require('./routes');
const http = require('http');
const userdb = require('./models/userschema');
const cookieParser = require('cookie-parser')
const admin = require("firebase-admin");
const { Server } = require("socket.io");
const serviceAccount = require("./serviceAccountKey.json");
const {socketAuthenticator} = require('./controller/userAuthController.js');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_BUCKET_PATH
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors:{
    origin: 'http://localhost:5173',
    credentials: true,
    },
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
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({extended:true}));


app.get('/', (req,res)=>{
    res.send("Hello from server")
})

app.use('/api', router);


//socket
const userSocketIDs = new Map();

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  userSocketIDs.set(socket.user._id.toString(), socket.id);
  console.log("Current User socket IDs are:", userSocketIDs);
  socket.broadcast.emit("USER_CONNECTED", Object.fromEntries(userSocketIDs));

  // socket.on("NEW_USER", (data) => {
  //   console.log("New user event received:", data);
  //   socket.broadcast.emit("NEW_USER", data);
  // });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    userSocketIDs.delete(socket.user._id.toString());
    console.log("Current User socket IDs are:", userSocketIDs);

    socket.broadcast.emit("USER_DISCONNECTED", Object.fromEntries(userSocketIDs));
  })

});


server.listen(5000, ()=>{
    console.log("Server running on port 5000");
})