const express = require('express');
const router = express.Router();
const upload = require('multer')({ dest: "temp/" });
const userAuthController = require('./controller/userAuthController');
const userDetailsController = require('./controller/userDetailsController');

//Register
router.post('/auth/register', upload.single('profilePhoto'), userAuthController.authRegister);
router.post('/auth/googleregister', userAuthController.googleauth);

//Login
router.post('/auth/login', upload.single('profilePhoto'), userAuthController.authLogin);
router.post('/auth/googlelogin', userAuthController.googleLoginAuth);

//Refresh Token
router.get('/auth/refresh', userAuthController.refreshToken);

//users
router.get('/users', userDetailsController.users);

module.exports = router;