const express = require('express');
const { getUsers, connectUser, getUserProfile, updateUserProfile, uploadProfileImage, registerUser, loginUser, forgotPassword, resetPassword, getVolunteerProfile, getVolunteerProfileByUsername } = require('../controllers/userController');
const { getDashboardData } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Route to fetch all users (for testing)
router.get('/', getUsers);

// Route to connect two users
router.post('/connect/:id', connectUser);

// Route for dashboard data
router.get('/dashboard', protect, getDashboardData);

// Get user profile
router.get('/profile', protect, getUserProfile);

// Get specific volunteer's profile
router.get('/profile/:id', protect, getVolunteerProfile);

// Get specific volunteer's profile by username
router.get('/volunteer/:username', protect, getVolunteerProfileByUsername);

// Update user profile
router.put('/profile', protect, updateUserProfile);

// Upload profile image
router.post('/upload-profile-image', protect, uploadProfileImage);

// Register a new user
router.post('/register', registerUser);

// Login user
router.post('/login', loginUser);

// Forgot password
router.post('/forgot-password', forgotPassword);

// Reset password
router.post('/reset-password/:token', resetPassword);

module.exports = router;
