const express = require('express');
const { getDashboardData } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Define the route for fetching dashboard data
router.get('/', protect, getDashboardData);

module.exports = router;
