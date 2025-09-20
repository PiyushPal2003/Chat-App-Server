const convoDb = require("../models/conversationSchema");
const chatDb = require("../models/chatschema");
const fs = require("fs");

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

const fetchChatDetails = async(req, res) => {
    try{
        const chatDetails = await convoDb.findById(req.params.id).populate("members", "-password -email -__v");
        if(chatDetails){
            res.status(200).json({ message: "Chat details fetched", chat: chatDetails });
        }
        else{
            res.status(404).json({ message: "Chat not Found" });
        }
    }
    catch(err){
        console.log(err);
        res.status(500).json({ message: "Chat not Found, Server Error" });
    }
}




const sendChat = async (req, res) => {
  try {
    const io = req.app.get("io");
    const userSocketIDs = req.app.get("userSocketIDs");
    const convoId = req.params.id;
    const { message, receiverId } = req.body;
    const senderId = req.user.id;
    const admin = require("firebase-admin");
    const bucket = admin.storage().bucket();

    if (!convoId || !message || !senderId || !receiverId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    console.log("Body", req.body);
    console.log("Files received:", req.files);

    let fileUrlArray = [];

    if (req.files && req.files.length > 0) {
      // Upload all files
      for (const file of req.files) {
        const destination = `ChatAppUsersDoc/${senderId}_${convoId}_${Date.now()}_${file.originalname}`;
        await bucket.upload(file.path, {
          destination,
          metadata: {
            contentType: file.mimetype,
          },
        });

        await fs.promises.unlink(file.path); // non-blocking
        const uploadedFile = bucket.file(destination);

        // ⚠️ Optional: don't always make public; better to generate signed URL
        await uploadedFile.makePublic();

        const url = `https://storage.googleapis.com/${bucket.name}/${destination}`;
        fileUrlArray.push(url);
      }
    }

    const chatConvoDB = await convoDb.findById(convoId);
    if (!chatConvoDB) {
      return res.status(404).json({ message: "Chat not Found" });
    }

    const chat = new chatDb({
      conversationId: convoId,
      senderId,
      receiverId,
      message: {
        text: message,
        url: fileUrlArray.length > 0 ? fileUrlArray : undefined,
      },
    });

    await chat.save();

    // Update last message in conversation
    chatConvoDB.lastMessage = message;
    await chatConvoDB.save();

    // Send to receiver if online
    const receiverSocket = userSocketIDs.get(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit("newMessage", chat); // send full chat object
    }

    return res.status(200).json({
      message: "Chat sent and convoDB updated successfully",
      chat,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Chat not sent, Server Error" });
  }
};


module.exports = { newChat, getChats, fetchChatDetails, sendChat};