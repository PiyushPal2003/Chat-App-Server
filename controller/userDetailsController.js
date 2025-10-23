const userdb = require('../models/userschema');
const fs = require("fs");

const currentUser = async (req, res) => {
  try {
    const usr = await userdb.findById(req.user.id).select('-password');
    if(usr){
      res.status(200).json({ message: 'User Found' , user: usr });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

const users = async (req, res) => {
  try {
    const users = await userdb.find();
    const userList = users.filter(user => user._id.toString() !== req.user.id);
    res.status(200).json({ Users: userList });
  }
  catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const editProfile = async (req, res) => {
  try{
    console.log(req.file);
    console.log(req.body);
    const {id} = req.user;
    const user = await userdb.findById(id);
    const admin = require("firebase-admin");
    const bucket = admin.storage().bucket();
    let publicUrl;

    const file = req.file;
    if(file){
      const alreadyStored = user.profilePhoto.includes('storage.googleapis.com')?user.profilePhoto.split('.appspot.com/')[1] : null;

      if(alreadyStored){
        const existingFile = bucket.file(alreadyStored);
        await existingFile.delete().catch((err)=>{
          console.log("Error deleting existing file:", err);
        });
      }
      
      const destination = `ChatAppUsersProfilePhoto/${user.name}_${user.email}_${Date.now()}`;

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

    if(req.body.name){
      user.name = req.body.name;
    }
    if(publicUrl){
      user.profilePhoto = publicUrl;
    }
    if(req.body.desc){
      user.desc = req.body.desc;
    }

    await user.save({ validateModifiedOnly: true }, );

    res.status(200).json({ message: "Profile updated successfully", usr: user });

  }
  catch(error){
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {currentUser, users, editProfile};