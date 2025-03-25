const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  getSenders,
  getMessages,
  replyToMessage,
  sendMessage
} = require('../controllers/chatController');

const router = express.Router();

// Get list of event managers who have sent messages to the volunteer
router.get('/senders', protect, getSenders);

// Get messages between volunteer and event manager
router.get('/messages/:senderId', protect, getMessages);

// Send a reply to an event manager
router.post('/reply', protect, replyToMessage);

// Send message to volunteers (for event managers)
router.post('/send', protect, sendMessage);

module.exports = router;
