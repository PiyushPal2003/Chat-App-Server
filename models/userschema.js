const mongoose = require('mongoose');
const { hash } = require('bcryptjs');

const user_details = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: [10, 'Name must be upto 10 characters'],
    },
    email: {   
        type: String,
        required: true,
        unique: true,
    },
    profilePhoto: {
        type: String,
    },
    password: {
        type: String,
        // required: true,
        validate: {
            validator: function(v) {
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{3,8}$/.test(v);
            },
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and up to 8 characters.',
        },
    },
})

user_details.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await hash(this.password, 10);
  next();
});


const userdb = new mongoose.model("user_detail", user_details);
module.exports = userdb;