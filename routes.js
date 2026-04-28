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

//current user
router.get('/currentuser', verifyToken, userDetailsController.currentUser);

//users
router.get('/users', verifyToken, userDetailsController.users);

//edit profile
router.patch('/editprofile', verifyToken, upload.single('profilePhoto'), userDetailsController.editProfile);

//new chat
router.post('/createchats', verifyToken, userChatsController.newChat);

//new group chat
router.post('/creategroup', upload.single('grpPhoto'),  verifyToken, userChatsController.newGroupChat);

//edit group chat
router.patch('/editgroup', upload.single('grpPhoto'),  verifyToken, userChatsController.editGroupChat);

//get chat list
router.get('/chats/:id', verifyToken, userChatsController.getChats);

//fetch chat details
router.get('/fetchchat/:id', verifyToken, userChatsController.fetchChatDetails);

//send chat
router.post('/sendchat/:id', verifyToken, upload.array("files"), userChatsController.sendChat);

//forward message
router.post('/forwardchat', verifyToken, userChatsController.forwardChat);

//edit message
router.patch('/editmessage/:messageId', verifyToken, userChatsController.editMessage);

//delete message
router.delete('/deletemessage/:messageId', verifyToken, userChatsController.deleteMessage);

//fetch Messages
router.get('/fetchmessages', verifyToken, userChatsController.fetchMessages);

module.exports = router;
