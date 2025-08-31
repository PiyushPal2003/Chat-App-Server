const express = require('express');
const router = express.Router();
var jwt = require('jsonwebtoken');
const upload = require('multer')({ dest: "temp/" });
const userAuthController = require('./controller/userAuthController');
const userDetailsController = require('./controller/userDetailsController');
const userChatsController = require('./controller/userChatsController');


const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const authCookie = req.cookies['chatRefreshToken'];
  if (!authHeader || !authCookie) {
    return res.status(401).json({ message: "No access token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Invalid token format" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.user = decoded;
    next();
  });
};


//Register
router.post('/auth/register', upload.single('profilePhoto'), userAuthController.authRegister);
router.post('/auth/googleregister', userAuthController.googleauth);

//Login
router.post('/auth/login', upload.single('profilePhoto'), userAuthController.authLogin);
router.post('/auth/googlelogin', userAuthController.googleLoginAuth);

//Refresh Token
router.get('/auth/refresh', userAuthController.refreshToken);

//users
router.get('/users', verifyToken, userDetailsController.users);

//new chat
router.post('/createchats', verifyToken, userChatsController.newChat);

//get chat list
router.get('/chats/:id', verifyToken, userChatsController.getChats);

module.exports = router;