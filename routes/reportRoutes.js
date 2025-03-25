const express = require("express");
const { getVolunteerReports, getManagerReports } = require("../controllers/reportsController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// ✅ Route to fetch volunteer reports
router.get("/volunteer", protect, getVolunteerReports);

// ✅ Route to fetch manager reports
router.get("/manager", protect, getManagerReports);

module.exports = router;
