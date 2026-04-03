const mongoose = require('mongoose');
const { hash } = require('bcryptjs');
// const { refreshToken } = require('firebase-admin/app');

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
    desc: {
        type: String,
        maxlength: [50, 'Description must be upto 50 characters'],
        default: "",
    },
    password: {
        type: String,
        // required: true,
        validate: {
            validator: function(v) {
                return /^.{1,8}$/.test(v);
            },
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and up to 8 characters.',
        },
    },
    refreshToken:{
        type: String,
    },
}
, { timestamps: true });

user_details.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await hash(this.password, 10);
  next();
});


const userdb = new mongoose.model("user_detail", user_details);
module.exports = userdb;