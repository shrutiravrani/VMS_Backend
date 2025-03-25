const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // ✅ Store all members
  messages: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: { type: String, default: '' },
      mediaUrl: { type: String, default: null },
      recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For broadcast messages
      createdAt: { type: Date, default: Date.now },
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Chat', chatSchema);
