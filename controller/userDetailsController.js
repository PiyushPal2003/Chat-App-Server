const userdb = require('../models/userschema');

const users = async (req, res) => {
  try {
    const users = await userdb.find();
    // console.log(users); // now you'll see the actual user data
    res.status(200).json({ Users: users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {users};