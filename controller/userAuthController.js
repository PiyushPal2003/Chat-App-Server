const path = require("path");
const fs = require("fs");
const userdb = require('../models/userschema');
var jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_OAUTH_KEY,
  });

  const payload = ticket.getPayload();
  return payload; // contains email, name, picture, etc.
}


// Controller for user authentication
const authRegister = async(req, res) => {
    if(req.body.type == 'Sign up') {
        const admin = require("firebase-admin");
        const bucket = admin.storage().bucket();
        let publicUrl;
        
        const file = req.file;
        if(file){
            const destination = `ChatAppUsersProfilePhoto/${req.body.name}_${req.body.email}_${Date.now()}`;

            await bucket.upload(file.path, {
            destination: destination,
            metadata: {
                contentType: file.mimetype,
            },
            });
            fs.unlinkSync(file.path);
            const uploadedFile = bucket.file(destination);
            await uploadedFile.makePublic();

            publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
        }

        const user = new userdb({
            name: req.body.name,
            email: req.body.email,
            profilePhoto: publicUrl ? publicUrl : 'NA',
            password: req.body.password
        });

        user.save()
            .then(() => {
                const refreshToken = jwt.sign({ name: req.body.name, email: req.body.email, photo: publicUrl ? publicUrl : 'NA', type: 'Refresh' }, process.env.JWT_SECRET, { expiresIn: '7d' });

                const accessToken = jwt.sign({ name: req.body.name, email: req.body.email, photo: publicUrl ? publicUrl : 'NA', type: 'Access' }, process.env.JWT_SECRET, { expiresIn: '1h' });

                res.cookie('chatRefreshToken', refreshToken, {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'LAX', 
                    path: '/',
                    maxAge: 7 * 24 * 60 * 60 * 1000,
                });

                res.status(200).json({message: "User Created Successfully", 
                                accessToken: accessToken,
                                user: { 
                                    name: req.body.name,
                                    email: req.body.email,
                                    profilePhoto: publicUrl ? publicUrl : 'NA' }
                                });

            })
            .catch((error) => {
                console.error("Error creating user:", error);
                res.status(400).json({ error: "Error creating user", details: error });
            });
    }
}

const googleauth = async(req, res) => {
    try{
        const payload = await verifyGoogleToken(req.body.googleAuthToken);

        const user = new userdb({
            name: payload.name,
            email: payload.email,
            profilePhoto: payload.picture ? payload.picture : 'NA',
        });
        user.save()
            .then(() => {
                const refreshToken = jwt.sign({ name: payload.name, email: payload.email, photo: payload.picture, type: 'Refresh' }, process.env.JWT_SECRET, { expiresIn: '7d' });

                const accessToken = jwt.sign({ name: payload.name, email: payload.email, photo: payload.picture, type: 'Access' }, process.env.JWT_SECRET, { expiresIn: '1h' });

                res.cookie('chatRefreshToken', refreshToken, {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'LAX', 
                    path: '/',
                    maxAge: 7 * 24 * 60 * 60 * 1000,
                });

                res.status(200).json({message: "Google Auth Success, User created", 
                        accessToken: accessToken,
                        user: { 
                            name: payload.name,
                            email: payload.email,
                            profilePhoto: payload.picture }
                        });
            })
            .catch((error) => {
                console.error("Error creating user:", error);
                res.status(400).json({ error: "Error creating user", details: error });
            });
    } 
    catch (error) {
        console.error('Google Auth Error:', error);
        res.status(400).json({error: "Google Auth Failed", details: error.message});
    }
}

module.exports = {authRegister, googleauth}