const convoDb = require("../models/conversationSchema");

const newChat = (req, res) => {
    try{
        console.log(req.body.id, req.user.id);
        // console.log(req.body.id.id);
        const newConvo = new convoDb({
            members: [req.body.id, req.user.id],
        })
        newConvo.save()
        .then(()=>{
            res.status(200).json({ message: "New chat created with: "+ req.body.id, chat: newConvo});
        })
        .catch((err)=>{
            res.status(400).json({ message: err });
        })
    }
    catch(err){
        console.log(err);
        res.status(500).json({ message: "Error New chat not created" });
    }
}


const getChats = async(req, res) => {

    const chatList = await convoDb.find({ members: { $in: [req.params.id] }})
                                    .populate("members", "-password -email -__v")
                                    .sort({ updatedAt: -1 });

  res.status(200).json({ message: "Get chats", chats: chatList });
}

module.exports = { newChat, getChats };