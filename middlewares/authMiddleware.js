const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    console.log('Token:', token); // Debug the token
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded Token:', decoded); // Debug the decoded token

    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    console.log('Authenticated User:', req.user); // Debug the authenticated user
    next();
  } catch (error) {
    console.error('Token Error:', error.message); // Debug token errors
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };
