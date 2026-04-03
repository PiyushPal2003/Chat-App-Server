const userdb = require('../models/userschema');
const { uploadFile, deleteFile } = require('../utils/supabaseStorage');

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
    const {id} = req.user;
    const user = await userdb.findById(id);
    let publicUrl;

    const file = req.file;
    if(file){
      // Delete old photo if it exists (handles both Firebase and Supabase URLs)
      if(user.profilePhoto && user.profilePhoto !== 'NA'){
        await deleteFile(user.profilePhoto);
      }
      
      // Upload new photo to Supabase
      const customName = `${user.name}_${user.email}_${Date.now()}`;
      publicUrl = await uploadFile(file, 'profiles', customName);
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

    await user.save({ validateModifiedOnly: true });

    res.status(200).json({ message: "Profile updated successfully", usr: user });

  }
  catch(error){
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {currentUser, users, editProfile};