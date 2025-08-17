const path = require("path");
const fs = require("fs");
const bcrypt = require('bcryptjs');
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

        const usr = await userdb.findOne({email: req.body.email})
        if(usr){
            return res.status(201).json({message: "already registered"});
        }
        
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

        const refreshToken = jwt.sign({ name: req.body.name, email: req.body.email, photo: publicUrl ? publicUrl : 'NA', type: 'Refresh' }, process.env.JWT_SECRET, {expiresIn: '7d'});
        const accessToken = jwt.sign({ name: req.body.name, email: req.body.email, photo: publicUrl ? publicUrl : 'NA', type: 'Access' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const user = new userdb({
            name: req.body.name,
            email: req.body.email,
            profilePhoto: publicUrl ? publicUrl : 'NA',
            password: req.body.password,
            refreshToken: refreshToken
        });

        user.save()
            .then(() => {
                res.cookie('chatRefreshToken', refreshToken, {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'LAX', 
                    path: '/',
                    maxage: 7 * 24 * 60 * 60 * 1000
                });

                io.emit('NEW_USER', user);
                return res.status(200).json({message: "User Created Successfully", 
                                accessToken: accessToken,
                                user: { 
                                    name: req.body.name,
                                    email: req.body.email,
                                    profilePhoto: publicUrl ? publicUrl : 'NA' }
                                });
            })
            .catch((error) => {
                console.error("Error creating user:", error);
                return res.status(400).json({ error: "Error creating user", details: error });
            });
    }
}

const googleauth = async(req, res) => {
    try{
        const payload = await verifyGoogleToken(req.body.googleAuthToken);
        
        const usr = await userdb.findOne({email: payload.email})
        if(usr){
            return res.status(201).json({error: "already registered"});
        }

        const refreshToken = jwt.sign({ name: payload.name, email: payload.email, photo: payload.picture, type: 'Refresh' }, process.env.JWT_SECRET, {expiresIn: '7d'});
        
        const accessToken = jwt.sign({ name: payload.name, email: payload.email, photo: payload.picture, type: 'Access' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const user = new userdb({
            name: payload.name,
            email: payload.email,
            profilePhoto: payload.picture ? payload.picture : 'NA',
            refreshToken: refreshToken
        });

        user.save()
            .then(() => {
                res.cookie('chatRefreshToken', refreshToken, {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'LAX', 
                    path: '/',
                    maxAge: 7 * 24 * 60 * 60 * 1000
                });

                return res.status(200).json({message: "Google Auth Success, User created", 
                        accessToken: accessToken,
                        user: { 
                            name: payload.name,
                            email: payload.email,
                            profilePhoto: payload.picture }
                        });
            })
            .catch((error) => {
                console.error("Error creating user:", error);
                return res.status(400).json({ error: "Error creating user", details: error });
            });
    } 
    catch (error) {
        console.error('Google Auth Error:', error);
        return res.status(400).json({error: "Google Auth Failed", details: error.message});
    }
}





/////////////////////////login controller

const authLogin = async(req, res)=>{
    try{
        const refreshToken = req.cookies.chatRefreshToken;

        const user = await userdb.findOne({email: req.body.email})
        if(!user){
            return res.status(400).json({error: "User not found"});
        }
        else if(!user.password){
            return res.status(201).json({
                message: "Other method",
            });
        }

        bcrypt.compare(req.body.password, user.password, (err, result) => {
            if (err) {
                console.error('Error while comparing passwords:', err);
                return res.status(500).json({ error: 'Server error' });
            }
            if (!result) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            const accessToken = jwt.sign({ name: user.name, email: user.email, photo: user.profilePhoto, type: 'Access' }, process.env.JWT_SECRET, { expiresIn: '1h' });

            if (!refreshToken) {
                res.cookie('chatRefreshToken', user.refreshToken, {
                    httpOnly: true,
                    secure: false,
                    sameSite: 'LAX', 
                    path: '/',
                    maxAge: 7 * 24 * 60 * 60 * 1000
                });
            }

            return res.status(200).json({ message: 'Login successful', token: accessToken, user: {
                name: user.name,
                email: user.email,
                profilePhoto: user.profilePhoto
            }});
        })  
    }
    catch(error){
        console.error('Login Error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }

}


const googleLoginAuth = async(req,res)=>{
    try{
        const refreshToken = req.cookies.chatRefreshToken;
        const payload = await verifyGoogleToken(req.body.googleAuthToken);
        
        const user = await userdb.findOne({email: payload.email})
        if(!user){
            return res.status(400).json({error: "User not found"});
        }
        
        const accessToken = jwt.sign({ name: payload.name, email: payload.email, photo: payload.picture, type: 'Access' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        if (!refreshToken) {
            res.cookie('chatRefreshToken', user.refreshToken, {
                httpOnly: true,
                secure: false,
                sameSite: 'LAX', 
                path: '/',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
        }

        return res.status(200).json({ message: 'Login successful', token: accessToken, user: {
                name: user.name,
                email: user.email,
                profilePhoto: user.profilePhoto
        }}
    );

    }
    catch(error){
        console.error('Google Login Error:', error);
        return res.status(500).json({ error: 'Server error', details: error.message });
    }
}



// Refresh Token Controller
const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.chatRefreshToken;
//   console.log(refreshToken);
  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token provided" });
  }
  try {
    jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error("Invalid refresh token:", err);
        return res.status(403).json({ error: "Invalid refresh token" });
      }
      const newAccessToken = jwt.sign(
        {
          name: decoded.name,
          email: decoded.email,
          photo: decoded.photo,
          type: "Access",
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        message: "Token refreshed successfully",
        accessToken: newAccessToken,
        user: {
          name: decoded.name,
          email: decoded.email,
          profilePhoto: decoded.photo,
        },
      });
    });
  } catch (error) {
    console.error("Refresh Token Error:", error);
    return res.status(500).json({ error: "Server error", details: error.message });
  }
};


module.exports = {authRegister, googleauth, authLogin, googleLoginAuth, refreshToken}