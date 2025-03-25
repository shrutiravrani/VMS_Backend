const User = require('../models/User');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Signup Functionality
const signup = async (req, res) => {
  try {
    const { name, email, password, role, bio, interestedSkills } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      bio,
      interestedSkills: role === 'volunteer' ? interestedSkills || [] : [], // Only for volunteers
    });

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // Return the response
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        interestedSkills: user.interestedSkills,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


// Login Functionality
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    // Return the response
    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        interestedSkills: user.interestedSkills,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Request Password Reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Set the reset token and expiry on the user model
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour validity
    await user.save();

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail', // You can change this based on your email provider
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password
      },
    });

    // Construct the reset URL
    const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // Send the email
    await transporter.sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click <a href="${resetURL}">here</a> to reset your password. This link will expire in 1 hour.</p>`,
    });

    // Respond to the client
    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Password reset error:', error.message);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    // Find the user with a valid reset token
    const user = await User.findOne({
      resetToken,
      resetTokenExpiry: { $gt: Date.now() }, // Token must not be expired
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password and clear the reset token fields
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Password Reset Error:', error.message);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};
module.exports = { signup, login, requestPasswordReset, resetPassword };
