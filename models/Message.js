const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  text: {
    type: String,
    required: true
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  messageType: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  }
}, {
  timestamps: true
});

// Pre-save middleware to handle message creation
messageSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      const User = mongoose.model('User');
      
      // Update unread message count for all recipients
      for (const recipientId of this.recipients) {
        try {
          const recipient = await User.findById(recipientId);
          if (recipient) {
            await recipient.updateMessageCount(this.sender, true);
          }
        } catch (err) {
          console.error(`Failed to update message count for recipient ${recipientId}:`, err);
          // Continue with other recipients even if one fails
        }
      }
    }
    next();
  } catch (err) {
    console.error('Error in message pre-save middleware:', err);
    next(); // Continue saving the message even if updating counts fails
  }
});

// Method to mark message as read
messageSchema.methods.markAsRead = async function(userId) {
  if (!this.readBy.some(read => read.user.toString() === userId.toString())) {
    this.readBy.push({ user: userId, readAt: new Date() });
    await this.save();

    // Update recipient's unread count
    const User = mongoose.model('User');
    const recipient = await User.findById(userId);
    if (recipient) {
      await recipient.updateMessageCount(this.sender, false);
    }

    return true;
  }
  return false;
};

// Static method to get unread count
messageSchema.statics.getUnreadCount = async function(userId, senderId) {
  return await this.countDocuments({
    recipients: userId,
    sender: senderId,
    'readBy.user': { $ne: userId }
  });
};

module.exports = mongoose.model('Message', messageSchema); 