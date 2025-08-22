const convoDb = require("../models/conversationSchema");

const newChat = (req, res) => {
    try{
        const newConvo = new convoDb({
            members: req.body.members,
        })
        res.status(200).json({ message: "New chat created" });
    }
    catch(err){
        console.log(err);
        res.status(500).json({ message: "Error New chat not created" });
    }
}


const getChats = (req, res) => {
  res.status(200).json({ message: "Get chats" });
}