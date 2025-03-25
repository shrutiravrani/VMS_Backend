const Chat = require("../models/Chat");
const Event = require("../models/Event");
const User = require("../models/User");
const { getIo } = require("../models/socket");
const Message = require('../models/Message');

// Get user's chats (events where messages were exchanged)
const getUserChats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all events where the user is either a team member or event manager
    const events = await Event.find({
      $or: [
        { "team.members": userId },
        { createdBy: userId }
      ]
    }).select('title');

    // Format the response
    const chats = events.map(event => ({
      eventId: event._id,
      title: event.title
    }));

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch chats", error: error.message });
  }
};

// Get messages for a specific event
const getChatMessages = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user is part of the event
    const isTeamMember = event.team.members.includes(userId);
    const isEventManager = event.createdBy.toString() === userId.toString();
    if (!isTeamMember && !isEventManager) {
      return res.status(403).json({ message: "Not authorized to view these messages" });
    }

    // Get messages for this event
    const chat = await Chat.findOne({ eventId })
      .populate('messages.sender', 'name')
      .select('messages');

    res.json(chat ? chat.messages : []);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages", error: error.message });
  }
};

// Send message to selected volunteers
const sendMessage = async (req, res) => {
  try {
    const { message, recipients } = req.body;
    const senderId = req.user._id;

    if (!message.trim()) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: "Please select at least one recipient" });
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
    recipients.forEach(recipientId => {
      io.to(recipientId.toString()).emit("receiveMessage", populatedMessage);
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ message: "Failed to send message", error: error.message });
  }
};

// Get list of event managers who have sent messages to the volunteer
const getSenders = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    // Get all messages sent to this volunteer
    const messages = await Message.find({
      recipients: userId
    })
    .populate('sender', 'name')
    .sort({ createdAt: -1 })
    .lean();

    // Extract unique senders with additional info
    const senders = [...new Map(
      messages.map(msg => [
        msg.sender._id.toString(),
        {
          _id: msg.sender._id,
          name: msg.sender.name,
          lastMessage: msg.text,
          lastMessageTime: msg.createdAt,
          unreadCount: user.unreadMessages.get(msg.sender._id.toString()) || 0
        }
      ])
    ).values()];

    res.json(senders);
  } catch (error) {
    console.error('Error getting senders:', error);
    res.status(500).json({ message: 'Failed to get senders' });
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
  getChatMessages,
  sendMessage,
  getSenders,
  getMessages,
  replyToMessage
};
