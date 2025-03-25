const { Server } = require("socket.io");
const Chat = require("./Chat");
const Message = require("./Message");

let io;

const initIo = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
  });

  io.on("connection", (socket) => {
    console.log("🔥 New client connected:", socket.id);

    // Join user's personal room
    socket.on("joinUserRoom", (userId) => {
      socket.join(userId);
      console.log(`User joined their personal room: ${userId}`);
    });

    // Join event chat room
    socket.on("joinEventChat", (eventId) => {
      socket.join(eventId);
      console.log(`User joined event chat: ${eventId}`);
    });

    // Handle sending messages
    socket.on("sendMessage", async (data) => {
      try {
        const { sender, recipients, message } = data;
        
        // Create a new message for each recipient
        for (const recipientId of recipients) {
          const newMessage = new Message({
            sender: sender._id,
            recipient: recipientId,
            text: message,
            createdAt: new Date()
          });
          
          await newMessage.save();
          
          // Emit to recipient's room
          io.to(recipientId).emit("receiveMessage", {
            ...newMessage.toObject(),
            sender
          });
        }
      } catch (error) {
        console.error("❌ WebSocket Error:", error);
      }
    });

    // Handle message read status
    socket.on("markAsRead", async (data) => {
      try {
        const { messageId, userId } = data;
        await Message.findByIdAndUpdate(messageId, { read: true });
        
        // Notify sender that message was read
        const message = await Message.findById(messageId);
        if (message) {
          io.to(message.sender.toString()).emit("messageRead", { messageId });
        }
      } catch (error) {
        console.error("❌ WebSocket Read Status Error:", error);
      }
    });

    // Handle broadcast messages
    socket.on("broadcastMessage", async (data) => {
      try {
        const { eventId, sender, message, mediaUrl, recipients } = data;
        if (!eventId || !recipients) {
          console.log("Warning: Missing required data for broadcast!");
          return;
        }

        const chatGroup = await Chat.findOne({ eventId });

        if (!chatGroup) {
          console.log("Chat group not found for event:", eventId);
          return;
        }

        const newMessage = {
          sender: sender._id,
          text: message,
          mediaUrl: mediaUrl || null,
          recipients,
          createdAt: new Date(),
        };

        chatGroup.messages.push(newMessage);
        await chatGroup.save();

        // Emit to specific recipients
        recipients.forEach(recipientId => {
          io.to(recipientId).emit("receiveMessage", { ...newMessage, sender });
        });
      } catch (error) {
        console.error("❌ WebSocket Broadcast Error:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initIo, getIo };
