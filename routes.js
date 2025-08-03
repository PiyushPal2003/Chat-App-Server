const express = require('express');
const router = express.Router();
const upload = require('multer')({ dest: "temp/" });
const userAuthController = require('./controller/userAuthController');

router.post('/auth/register', upload.single('profilePhoto'), userAuthController.authRegister);
router.post('/auth/googleregister', userAuthController.googleauth);

module.exports = router;