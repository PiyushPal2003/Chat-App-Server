const express = require('express');
const router = express.Router();
const upload = require('multer')({ dest: "temp/" });
const userAuthController = require('./controller/userAuthController');

//Register
router.post('/auth/register', upload.single('profilePhoto'), userAuthController.authRegister);
router.post('/auth/googleregister', userAuthController.googleauth);

//Login
router.post('/auth/login', upload.single('profilePhoto'), userAuthController.authLogin);
router.post('/auth/googlelogin', userAuthController.googleLoginAuth);

module.exports = router;