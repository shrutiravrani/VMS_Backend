const Message = require('../models/Message');
const Event = require('../models/Event');
const User = require('../models/User');
const { getIo } = require("../models/socket");

// Get user's message history with event managers
const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all messages where the user is either sender or recipient
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { recipients: userId }
      ]
    })
    .populate('sender', 'name')
    .sort({ createdAt: -1 })
    .lean();

    // Group messages by event manager
    const messagesByManager = messages.reduce((acc, msg) => {
      const otherParty = msg.sender._id.toString() === userId.toString() 
        ? msg.recipients[0] 
        : msg.sender._id;
      
      if (!acc[otherParty]) {
        acc[otherParty] = {
          lastMessage: msg.text,
          lastMessageTime: msg.createdAt
        };
      }
      return acc;
    }, {});

    res.json(messagesByManager);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch message history", error: error.message });
  }
};

// Send message to selected volunteers
const sendMessage = async (req, res) => {
  try {
    const { message, recipients, eventId } = req.body;
    const senderId = req.user._id;

    if (!message.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: "Please select at least one recipient" });
    }

    // If this is an event-based message, verify permissions
    if (eventId) {
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if sender is the event manager
      if (event.createdBy.toString() !== senderId.toString()) {
        return res.status(403).json({ message: "Only event managers can send event messages" });
      }

      // Verify all recipients are accepted volunteers for this event
      const validRecipients = event.applicants.filter(
        app => app.status === 'accepted' && recipients.includes(app.user.toString())
      );

      if (validRecipients.length !== recipients.length) {
        return res.status(400).json({ message: "Some recipients are not accepted volunteers for this event" });
      }
    }

    // Create new message
    const newMessage = new Message({
      sender: senderId,
      recipients: recipients,
      text: message.trim(),
      messageType: recipients.length > 1 ? 'group' : 'direct'
    });

    await newMessage.save();

    // Populate sender information for the response
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'name')
      .lean();

    // Emit to specific recipients using Socket.IO
    const io = getIo();
    if (io) {
      recipients.forEach(recipientId => {
        io.to(recipientId.toString()).emit("receiveMessage", populatedMessage);
      });
    } else {
      console.warn("Socket.IO instance not available");
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ message: "Failed to send message", error: error.message });
  }
};

// Get messages between volunteer and event manager
const getMessages = async (req, res) => {
  try {
    const { senderId } = req.params;
    const userId = req.user._id;

    // Get all messages between the volunteer and event manager
    const messages = await Message.find({
      $or: [
        { sender: senderId, recipients: userId },
        { sender: userId, recipients: senderId }
      ]
    })
    .populate('sender', 'name')
    .populate('readBy.user', 'name')
    .sort({ createdAt: 1 })
    .lean();

    // Mark messages as read
    const unreadMessages = messages.filter(
      msg => msg.sender._id.toString() === senderId &&
      !msg.readBy.some(read => read.user._id.toString() === userId)
    );

    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map(msg => 
          Message.findById(msg._id).then(message => 
            message.markAsRead(userId)
          )
        )
      );

      // Notify sender that messages were read
      const io = getIo();
      unreadMessages.forEach(msg => {
        io.to(senderId).emit('messageRead', { messageId: msg._id });
      });
    }

    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ message: 'Failed to get messages' });
  }
};

// Reply to an event manager's message
const replyToMessage = async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    const userId = req.user._id;

    if (!message || !recipientId) {
      return res.status(400).json({ message: 'Message and recipient are required' });
    }

    // Create new message
    const newMessage = new Message({
      sender: userId,
      recipients: [recipientId],
      text: message.trim(),
      messageType: 'direct'
    });

    await newMessage.save();

    // Populate sender information for the response
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'name')
      .lean();

    // Emit to recipient using Socket.IO
    const io = getIo();
    io.to(recipientId.toString()).emit("receiveMessage", populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ message: 'Failed to send reply' });
  }
};

module.exports = {
  getUserChats,
  sendMessage,
  getMessages,
  replyToMessage
};
