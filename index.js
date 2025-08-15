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
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

//   socket.on("sendMessage", (msg) => {
//     console.log("Message:", msg);
//     io.emit("receiveMessage", msg);
//   });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});


server.listen(5000, ()=>{
    console.log("Server running on port 5000");
})