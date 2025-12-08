const convoDb = require("../models/conversationSchema");
const chatDb = require("../models/chatschema");
const fs = require("fs");
// const chatdb = require("../models/chatschema");
const UserDb = require("../models/userschema");

const newChat = async(req, res) => {
    try{
          const io = req.app.get("io");
          const userSocketIDs = req.app.get("userSocketIDs");
          console.log(req.body.id, req.user.id);
          const memkey = [req.body.id, req.user.id].sort().join("_");
          const existingConvo = await convoDb.findOne({ membersKey: memkey });
          if(existingConvo){
              return  res.status(201).json({ status:201, message: "Chat already exists", chat: existingConvo});
          }
            // console.log(req.body.id.id);
          const newConvo = new convoDb({
              members: [req.body.id, req.user.id],
          })
          newConvo.save()
          .then(()=>{
              io.to(userSocketIDs.get(req.body.id)).emit("newChat", newConvo);
              res.status(200).json({status:200, message: "New chat created with: "+ req.body.id, chat: newConvo});
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

const newGroupChat = async(req, res) => {
  try{
    const user = req.user;
    console.log("payload", req.body);
    console.log("payload", req.body.payload);
        if(req.body.isGroupChat){
          const admin = require("firebase-admin");
          const bucket = admin.storage().bucket();
          let publicUrl;
          
          const file = req.file;
          if(file){
              const destination = `ChatAppGroupPhoto/${req.body.name}_${req.body.adminId}_${Date.now()}`;

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

          const newGroup = new convoDb({
              isGroupChat: true,
              grpname: req.body.name,
              description: req.body.grpDesc,
              members: JSON.parse(req.body.members),
              admin: req.body.adminId,
              photo: publicUrl || "NA",
          })
          const chat = new chatdb({
            conversationId: req.body.convoId,
            senderId: id,
            receiverId: receiverIds,
            message: {
              text: `|SystemGenerated| ${user.name} created the group "${req.body.name}"`,
            },
          })
          await Promise.all([
            newGroup.save(),
            chat.save()
          ])
          .then(()=>{
              res.status(200).json({ message: "New Group chat created: "+ req.body.name, chat: newGroup});
          })
          .catch((err)=>{
            res.status(400).json({ message: err });
          })
        }
  }
  catch(err){
    console.log(err);
    res.status(500).json({ message: "Error New Group chat not created" });
  }
}

const getChats = async(req, res) => {

  // const chatList = await convoDb.find({ members: { $in: [req.params.id] }})
  //                                 .populate("members", "-password -email -__v")
  //                                 .sort({ updatedAt: -1 });
  // const convoIds = chatList.map(chat => chat._id);
  // console.log("Convo Ids:", convoIds);

  // const lastMessages = await chatDb.aggregate([
  //   { $match: { conversationId: { $in: convoIds } } },
  //   // { $sort: { createdAt: -1 } },
  //   {
  //     $group: {
  //       _id: "$conversationId",
  //       conversationId: { $first: "$conversationId" },
  //       message: { $first: "$message" },
  //       createdAt: { $first: "$createdAt" },
  //     }
  //   },
  //   { $sort: { createdAt: -1 } }
  // ]);

  const chatList = await convoDb.aggregate([
    { 
      $match: {
        $expr: {
          $in: [ { $toObjectId: req.params.id }, "$members" ]
        }
      }
    },
    { 
      $sort: { updatedAt: -1 } 
    },
    {
      $lookup: {
        from: "user_details",
        localField: "members",
        foreignField: "_id",
        as: "members"
      }
    },
    {
      $project: {
        "members.password": 0,
        "members.email": 0,
        "members.__v": 0,
        "members.refreshToken": 0
      }
    },
    {
      $lookup: {
        from: "chats",
        let: { convoId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: [ "$conversationId", "$$convoId" ] } } },
          { $sort: { _id: -1 } },
          { $limit: 1 },
          { $project: { 
            _id: 0,
            lastMessage: {
              $cond: [
                { $and: [
                    { $gt: [ { $strLenCP: "$message.text" }, 0 ] },
                    { $eq: [ { $size: "$message.url" }, 0 ] }
                  ]
                },  
                "$message.text",
                {
                  $cond: [
                    { $and: [
                        { $eq: [ { $strLenCP: "$message.text" }, 0 ] },
                        { $gt: [ { $size: "$message.url" }, 0 ] }
                      ]
                    },
                    {
                      $concat: [
                        { $toString: { $size: "$message.url" } },
                        " file",
                        {
                          $cond: [
                            { $gt: [ { $size: "$message.url" }, 1 ] },
                            "s",
                            ""
                          ]
                        }
                      ]
                    },
                    null
                  ]
                }
              ]
            },
            lastMessageTime: "$timestamp"
          } }
        ],
        as: "lastMessage"
      }
    },
    {
      $unwind: {
        path: "$lastMessage",
        preserveNullAndEmptyArrays: true
      }
    },
    { 
      $addFields: {
        lastMessage: { 
          $cond: [
            { $ifNull: [ "$lastMessage", false ] },
            "$lastMessage.lastMessage",
            null
          ]
        },
        lastMessageTime: { 
          $cond: [
            { $ifNull: [ "$lastMessage", false ] },
            "$lastMessage.lastMessageTime",
            null
          ]
        }
      }
    },
    // {
    //   $lookup:{
    //     from: "chats",
    //     let: { convoId: "$_id" },
    //     pipeline: [
    //       { $match: { $expr: { $eq: [ { $toObjectId: "$conversationId" }, "$$convoId" ] } } },
    //       { $sort: { createdAt: -1 } },
    //       { $limit: 1 }
    //     ],
    //     as: "allChats"
    //   },
    // },
    // {
    //   $unwind: {
    //     path: "$allChats",
    //     preserveNullAndEmptyArrays: true
    //   }
    // }
  ])

  console.log("Last Messages:", chatList);

  res.status(200).json({ message: "Get chats", chats: chatList });
}

const fetchChatDetails = async(req, res) => {
    try{
        const chatDetails = await convoDb.findById(req.params.id).populate("members", "-password -__v");
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
    const message = req.body.message;
    const receiverId = JSON.parse(req.body.receiverId);
    const senderId = req.user.id;
    const admin = require("firebase-admin");
    const bucket = admin.storage().bucket();

    if (!convoId || !senderId || !receiverId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    console.log("Body", req.body);
    console.log("Files received:", req.files);

    let fileUrlArray = [];

    const chatConvoDB = await convoDb.findById(convoId);
    if (!chatConvoDB) {
      return res.status(404).json({ message: "Chat not Found" });
    }

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

    const chat = new chatDb({
      conversationId: convoId,
      senderId,
      receiverId,
      message: {
        text: message ? message : undefined,
        url: fileUrlArray.length > 0 ? fileUrlArray : undefined,
      },
    });

    await chat.save();

    // Update last message in conversation
    // chatConvoDB.lastMessage = message ? message : fileUrlArray[0].split("_").pop();
    // await chatConvoDB.save();

    // Send to receiver if online
    receiverId.forEach(receiver => {
      const receiverSocket = userSocketIDs.get(receiver);
      if (receiverSocket) {
        io.to(receiverSocket).emit("newMessage", chat);
      } 
    });

    return res.status(200).json({
      message: "Chat sent and convoDB updated successfully",
      chat,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Chat not sent, Server Error" });
  }
};

const fetchMessages = async (req, res) => {
  try{
    const convoId = req.query.chatId;
    const lastMessageId = req.query.lastMessageId || null;
    console.log(lastMessageId);

    let query = { conversationId: convoId };
    if (lastMessageId) {
      query._id = { $lt: lastMessageId };
    }

    const conversation = await convoDb.findById(convoId);
    const messages = await chatDb.find(query).sort({ _id: -1 }).limit(15);
    //here we get data in descending order so we need to reverse it
    // if(lastMessageId == null){
      messages.reverse();
    // }
    // const messages = await chatDb.find(query).limit(15);

    if(messages.length < 15){
      res.status(200).json({ message: "Batch of 15 Messages", messages, conversation });
    }
    else{
      res.status(201).json({ message: "Last batch of Messages", messages, conversation });
    }

  }
  catch(err){
    console.log(err);
    res.status(500).json({ message: "Messages not fetched, Server Error" });
  }
}

const editGroupChat = async (req, res) => {
    try{
      console.log(req.file);
      console.log(req.body);
      const io = req.app.get("io");
      const userSocketIDs = req.app.get("userSocketIDs");
      const {id} = req.user;
      const convo = await convoDb.findById(req.body.convoId);
      const receivers = convo.members.filter(memberId => memberId.toString() !== id);
      let receiverIds = receivers.map(memberId => memberId.toString());
      console.log('receivers:', receiverIds);
      const admin = require("firebase-admin");
      const bucket = admin.storage().bucket();
      let publicUrl;
      let newAdmin;
      let responseTxt = "";
  
      const file = req.file;
      if(file){
        const alreadyStored = convo.photo.includes('storage.googleapis.com')?convo.photo.split('.appspot.com/')[1] : null;
  
        if(alreadyStored){
          const existingFile = bucket.file(alreadyStored);
          await existingFile.delete().catch((err)=>{
            console.log("Error deleting existing file:", err);
            res.status(500).json({ error: "Error while deleting previous photo" });
          });
        }
        
        // const destination = `ChatAppUsersProfilePhoto/${user.name}_${user.email}_${Date.now()}`;
        const destination = `ChatAppGroupPhoto/${req.body.old_grpname}_UpdatedGroupPhoto_By_${req.body.user}(${id})_${Date.now()}`;
  
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
        convo.grpname = req.body.name;
      }
      if(publicUrl){
        convo.photo = publicUrl;
      }
      if(req.body.description){
        convo.description = req.body.description;
      }
      responseTxt = `|SystemGenerated| ${req.body.user} updated the group's ${ publicUrl ? 'photo, ' : ''}${req.body.name ? 'name, ' : ''}${req.body.description ? 'description' : ''}`.replace(/, $/, '')

      if(req.body.admin){
        newAdmin = JSON.parse(req.body.admin);
        const newMembers = Array.from(new Set([...convo.admin.map(id => id.toString()), newAdmin.id]));
        convo.admin = newMembers;

        responseTxt = `|SystemGenerated| ${newAdmin.name} was made admin by ${req.body.user}`;
      }
      if(req.body.members){
        const newMem = JSON.parse(req.body.members);
        const newMembers = Array.from(new Set([...convo.members.map(id => id.toString()), ...newMem]));
        convo.members = newMembers;
        convo.membersKey = newMembers.sort().join("_");
        receiverIds = newMembers.filter((m)=>m!=id);

        const memNames = await UserDb.find({ _id: { $in: newMem } }).select('name');
        const newMemNames = memNames.map(user => user.name);
        responseTxt = `|SystemGenerated| ${req.user.name} added ${newMemNames.join(', ')} to the group`;
      }
      if(req.body.rm){
        const newMembers = Array.from(new Set([...convo.members.map(id => id.toString())])).filter((m)=>m!=req.body.rm);
        convo.members = newMembers;
        convo.membersKey = newMembers.sort().join("_");
        if(convo.admin.includes(req.body.rm)){
          const updatedAdmins = convo.admin.filter((a)=>a.toString()!==req.body.rm);
          convo.admin = updatedAdmins;
        }

        const removedUser = await UserDb.findById(req.body.rm);
        responseTxt = `|SystemGenerated| ${req.user.name} removed ${removedUser.name} from the group`;
      }
      if(req.body.leave){
        const newMembers = Array.from(new Set([...convo.members.map(id => id.toString())])).filter((m)=>m!=id);
        convo.members = newMembers;
        convo.membersKey = newMembers.sort().join("_");
        if(convo.admin.includes(req.body.leave)){
          const updatedAdmins = convo.admin.filter((a)=>a.toString()!==req.body.leave);
          convo.admin = updatedAdmins;
        }
        responseTxt = `|SystemGenerated| ${req.user.name} left the group`;
      }

      const chat = new chatdb({
        conversationId: req.body.convoId,
        senderId: id,
        receiverId: receiverIds,
        message: {
          text: responseTxt,
        },
      })
      await Promise.all([
        convo.save({ validateModifiedOnly: true }),
        chat.save()
      ]);
  
      receiverIds.forEach(receiver => {
        const receiverSocket = userSocketIDs.get(receiver);
        console.log('socket id', receiverSocket);
        if (receiverSocket) {
          io.to(receiverSocket).emit("newMessage", chat);
          if(req.body.members){
            io.to(receiverSocket).emit("newChat", convo);
          }
          if(req.body.rm || req.body.leave || req.body.description || req.body.name || publicUrl){
            io.to(receiverSocket).emit("updateUser", convo);
          }
        } 
      });
      res.status(200).json({ message: "Group Chat updated successfully", chat: chat });
    }
    catch(error){
      console.error(error);
      res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}


module.exports = { newChat, getChats, fetchChatDetails, sendChat, fetchMessages, newGroupChat, editGroupChat};