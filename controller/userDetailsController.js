const userdb = require('../models/userschema');

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

module.exports = {users};