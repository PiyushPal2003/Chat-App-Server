const express = require('express');
require('./connect');
const cors = require('cors');
const router = require('./routes');
const http = require('http');
const userdb = require('./models/userschema');
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_BUCKET_PATH
});
// var bucket = admin.storage().bucket();

const app = express();
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


app.listen(5000, ()=>{
    console.log("Server running on port 5000");
})