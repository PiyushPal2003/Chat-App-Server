const path = require("path");
const fs = require("fs");
const userdb = require('../models/userschema');

const auth = async(req, res) => {
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
                res.status(200).json({ message: "User created successfully", user });
            })
            .catch((error) => {
                console.error("Error creating user:", error);
                res.status(400).json({ error: "Error creating user", details: error });
            });
    }
}

module.exports = {auth}