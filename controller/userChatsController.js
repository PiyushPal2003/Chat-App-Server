const convoDb = require("../models/conversationSchema");
const chatDb = require("../models/chatschema");
const UserDb = require("../models/userschema");
const { uploadFile, deleteFile, uploadMultipleFiles } = require("../utils/supabaseStorage");

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
    if(req.body.isGroupChat){
      let publicUrl;
      
      // Upload group photo to Supabase
      const file = req.file;
      if(file){
        const customName = `${req.body.name}_${req.body.adminId}_${Date.now()}`;
        publicUrl = await uploadFile(file, 'groups', customName);
      }

      const newGroup = new convoDb({
          isGroupChat: true,
          grpname: req.body.name,
          description: req.body.grpDesc,
          members: JSON.parse(req.body.members),
          admin: req.body.adminId,
          photo: publicUrl || "NA",
      })
      const chat = new chatDb({
        conversationId: newGroup._id,
        senderId: req.body.adminId,
        receiverId: JSON.parse(req.body.members).filter(m => m !== req.body.adminId),
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
             lastMessageTime: "$timestamp",
             lastMessageEdited: "$isEdited"
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
        },
        lastMessageEdited: {
          $cond: [
            { $ifNull: [ "$lastMessage", false ] },
            "$lastMessage.lastMessageEdited",
            false
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
        const [chatDetails, attachmentMessages] = await Promise.all([
          convoDb.findById(req.params.id).populate("members", "-password -__v"),
          chatDb
            .find({
              conversationId: req.params.id,
              "message.url.0": { $exists: true },
            })
            .select("message.url")
            .sort({ timestamp: -1 }),
        ]);
        const convoAttachment = attachmentMessages.flatMap((msg) => msg?.message?.url || []);
        if(chatDetails){
            res.status(200).json({
              message: "Chat details fetched",
              chat: chatDetails,
              convoAttachment,
            });
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
    const replyToId = req.body.replyToId || null;
    let mentionUserIds = [];

    if (!convoId || !senderId || !receiverId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let fileUrlArray = [];
    let replyTo = undefined;

    const chatConvoDB = await convoDb.findById(convoId);
    if (!chatConvoDB) {
      return res.status(404).json({ message: "Chat not Found" });
    }
    if (req.body.mentions) {
      try {
        mentionUserIds = JSON.parse(req.body.mentions);
      } catch (parseError) {
        return res.status(400).json({ message: "Invalid mentions format" });
      }
      if (!Array.isArray(mentionUserIds)) {
        return res.status(400).json({ message: "Mentions must be an array" });
      }
    }

    if (replyToId) {
      const repliedMessage = await chatDb.findById(replyToId);
      if (!repliedMessage) {
        return res.status(404).json({ message: "Replied message not found" });
      }
      if (String(repliedMessage.conversationId) !== String(convoId)) {
        return res.status(400).json({ message: "Reply message must belong to same conversation" });
      }

      replyTo = {
        messageId: repliedMessage._id,
        senderId: repliedMessage.senderId,
        text: repliedMessage.message?.text || "",
      };
    }

    // Upload files to Supabase if present
    if (req.files && req.files.length > 0) {
      const prefix = `${senderId}_${convoId}`;
      fileUrlArray = await uploadMultipleFiles(req.files, 'chat-files', prefix);
    }

    let mentions = [];
    if (chatConvoDB.isGroupChat && mentionUserIds.length > 0) {
      const uniqueMentionIds = Array.from(
        new Set(
          mentionUserIds
            .map((id) => String(id))
            .filter((id) => id !== String(senderId) && chatConvoDB.members.some((m) => String(m) === id))
        )
      );
      if (uniqueMentionIds.length > 0) {
        const mentionUsers = await UserDb.find({ _id: { $in: uniqueMentionIds } }).select("_id name");
        mentions = mentionUsers.map((u) => ({ userId: u._id, name: u.name }));
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
      mentions,
      replyTo,
    });

    await chat.save();

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

const forwardChat = async (req, res) => {
  try {
    const io = req.app.get("io");
    const userSocketIDs = req.app.get("userSocketIDs");
    const senderId = req.user.id;
    const { sourceMessageId, targetConversationIds } = req.body;

    if (!sourceMessageId || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
      return res.status(400).json({ message: "sourceMessageId and targetConversationIds are required" });
    }

    const sourceMessage = await chatDb.findById(sourceMessageId);
    if (!sourceMessage) {
      return res.status(404).json({ message: "Source message not found" });
    }

    const uniqueConversationIds = Array.from(new Set(targetConversationIds.map((id) => String(id))));
    const conversations = await convoDb.find({ _id: { $in: uniqueConversationIds }, members: senderId });
    const conversationMap = new Map(conversations.map((convo) => [String(convo._id), convo]));

    const invalidConversations = uniqueConversationIds.filter((id) => !conversationMap.has(id));
    if (invalidConversations.length > 0) {
      return res.status(403).json({ message: "You can only forward to conversations you are part of" });
    }

    const forwardedPayload = {
      text: sourceMessage.message?.text || "",
      url: Array.isArray(sourceMessage.message?.url) ? sourceMessage.message.url : [],
    };

    const forwardedChats = [];
    for (const convoId of uniqueConversationIds) {
      const convo = conversationMap.get(convoId);
      const receiverIds = convo.members
        .map((memberId) => String(memberId))
        .filter((memberId) => memberId !== String(senderId));

      const forwardedChat = new chatDb({
        conversationId: convo._id,
        senderId,
        receiverId: receiverIds,
        message: forwardedPayload,
        forwardInfo: {
          isForwarded: true,
          sourceMessageId: sourceMessage._id,
          originalSenderId: sourceMessage.senderId,
        },
      });

      await forwardedChat.save();
      forwardedChats.push(forwardedChat);

      receiverIds.forEach((receiver) => {
        const receiverSocket = userSocketIDs.get(receiver);
        if (receiverSocket) {
          io.to(receiverSocket).emit("newMessage", forwardedChat);
        }
      });
    }

    return res.status(200).json({
      message: "Message forwarded successfully",
      chats: forwardedChats,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Message not forwarded, Server Error" });
  }
};

const editMessage = async (req, res) => {
  try {
    const io = req.app.get("io");
    const userSocketIDs = req.app.get("userSocketIDs");
    const senderId = req.user.id;
    const messageId = req.params.messageId;
    const newText = (req.body.message || "").trim();

    if (!messageId) {
      return res.status(400).json({ message: "messageId is required" });
    }
    if (!newText) {
      return res.status(400).json({ message: "Edited message cannot be empty" });
    }

    const chat = await chatDb.findById(messageId);
    if (!chat) {
      return res.status(404).json({ message: "Message not found" });
    }
    if (String(chat.senderId) !== String(senderId)) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }
    if (Array.isArray(chat.message?.url) && chat.message.url.length > 0) {
      return res.status(400).json({ message: "Messages with attachments cannot be edited" });
    }
    if (chat.message?.text?.includes?.("|SystemGenerated|")) {
      return res.status(400).json({ message: "System messages cannot be edited" });
    }
    if (chat.forwardInfo?.isForwarded || chat.message?.text?.includes?.("|Forwarded|")) {
      return res.status(400).json({ message: "Forwarded messages cannot be edited" });
    }

    const fifteenMinutesMs = 15 * 60 * 1000;
    const messageAgeMs = Date.now() - new Date(chat.timestamp).getTime();
    if (messageAgeMs > fifteenMinutesMs) {
      return res.status(400).json({ message: "Edit window expired. You can edit only within 15 minutes." });
    }

    chat.message.text = newText;
    chat.isEdited = true;
    chat.editedAt = new Date();
    await chat.save();

    chat.receiverId.forEach((receiver) => {
      const receiverSocket = userSocketIDs.get(String(receiver));
      if (receiverSocket) {
        io.to(receiverSocket).emit("messageEdited", chat);
      }
    });

    return res.status(200).json({
      message: "Message edited successfully",
      chat,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Message not edited, Server Error" });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const io = req.app.get("io");
    const userSocketIDs = req.app.get("userSocketIDs");
    const messageId = req.params.messageId;
    const deletionStatus = req.status;
    const deletedBy = String(req.user.id);
    const deletedByName = req.user.name;

    if (!messageId || !deletionStatus) {
      return res.status(400).json({ message: "messageId and status are required" });
    }
    if (deletionStatus !== "me" && deletionStatus !== "everyone") {
      return res.status(400).json({ message: "status must be either 'me' or 'everyone'" });
    }

    const chat = await chatDb.findById(messageId);
    if (!chat) {
      return res.status(404).json({ message: "Message not found, invalid messageId" });
    }

    const convo = await convoDb.findById(chat.conversationId);
    if (!convo) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isMember = convo.members.some((memberId) => String(memberId) === deletedBy);
    if (!isMember) {
      return res.status(403).json({ message: "You are not a member of this conversation" });
    }
    const isAdmin = (convo.admin || []).some((adminId) => String(adminId) === deletedBy);

    if(deletionStatus == "me"){
      const alreadyDeletedFor = chat.deleted.for.map(id => String(id));
      if(!alreadyDeletedFor.includes(deletedBy)){
        chat.deleted.for.push(deletedBy);
      }
    }
    else if(deletionStatus == "everyone"){
      const isSender = String(chat.senderId) === deletedBy;
      if (!isSender && !isAdmin) {
        return res.status(403).json({ message: "You cannot delete this message for everyone" });
      }
      if(chat.deleted.status === "everyone"){
        return res.status(400).json({ message: "Message is already deleted for everyone" });
      }

      if (!isAdmin) {
        const fifteenMinutesMs = 15 * 60 * 1000;
        const messageAgeMs = Date.now() - new Date(chat.timestamp).getTime();
        if (messageAgeMs > fifteenMinutesMs) {
          return res.status(400).json({ message: "Delete for everyone window expired. You can delete only within 15 minutes." });
        }
      }

      chat.deleted.status = "everyone";
      chat.deleted.text = isAdmin && !isSender
        ? `This message was deleted by admin ${deletedByName}`
        : `This message was deleted for everyone`;
    }
    
    await chat.save();

    //receiver
    if(deletionStatus == "me"){
      const requesterSocket = userSocketIDs.get(deletedBy);
      if (requesterSocket) {
        io.to(requesterSocket).emit("messageDeleted", { messageId, status: "me" });
      }
    }
    if(deletionStatus == "everyone"){
      convo.members.forEach((memberId) => {
        const memberSocket = userSocketIDs.get(String(memberId));
        if (memberSocket) {
          io.to(memberSocket).emit("messageDeleted", { messageId, status: deletionStatus });
        }
      });
    }

    return res.status(200).json({
      message: deletionStatus === "everyone" ? "Message deleted for everyone" : "Message deleted for you",
      chat,
    });
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Message not deleted, Server Error" });
  }
}

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

    const hasMore = messages.length === 15;
    res.status(200).json({
      message: hasMore ? "Batch of 15 Messages" : "Last batch of Messages",
      hasMore,
      messages,
      conversation,
    });

  }
  catch(err){
    console.log(err);
    res.status(500).json({ message: "Messages not fetched, Server Error" });
  }
}

const editGroupChat = async (req, res) => {
    try{
      const io = req.app.get("io");
      const userSocketIDs = req.app.get("userSocketIDs");
      const {id} = req.user;
      const convo = await convoDb.findById(req.body.convoId);
      const receivers = convo.members.filter(memberId => memberId.toString() !== id);
      let receiverIds = receivers.map(memberId => memberId.toString());
      let publicUrl;
      let newAdmin;
      let responseTxt = "";
  
      const file = req.file;
      if(file){
        // Delete old photo if exists (handles both Firebase and Supabase URLs)
        if(convo.photo && convo.photo !== 'NA'){
          await deleteFile(convo.photo);
        }
        
        // Upload new photo to Supabase
        const customName = `${req.body.old_grpname}_UpdatedBy_${req.body.user}_${Date.now()}`;
        publicUrl = await uploadFile(file, 'groups', customName);
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

      const chat = new chatDb({
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


module.exports = { newChat, getChats, fetchChatDetails, sendChat, forwardChat, editMessage, deleteMessage, fetchMessages, newGroupChat, editGroupChat};
