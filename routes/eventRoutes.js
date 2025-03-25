const express = require('express');
const router = express.Router();

const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  applyForEvent,
  getApplications,
  getMyApplications,
  updateApplicationStatus,
  getVolunteerEvents,
  getEventVolunteers,
  completeVolunteer
} = require('../controllers/EventController');
const { protect } = require('../middlewares/authMiddleware');

// Route to create an event
router.post('/', protect, createEvent);

// Route to fetch all events
router.get('/', protect, getEvents);

// Route to fetch events created by the event manager
router.get('/created', protect, getEvents);

// Route to get volunteers for a specific event
router.get('/:id/volunteers', protect, getEventVolunteers);

// Route to get a specific event
router.get('/:id', getEventById);

// Route to update an event
router.put('/:id', protect, updateEvent);

// Route to delete an event
router.delete('/:id', protect, deleteEvent);

// Route to apply for an event
router.post('/:id/apply', protect, applyForEvent);

// Route to get applications for an event
router.get('/:id/applications', protect, getApplications);

router.get('/my-applications', protect, getMyApplications);

// Route to update application status
router.put('/:id/applications/:applicationId', protect, updateApplicationStatus);

// Route to get volunteer events
router.get('/volunteer', protect, getVolunteerEvents);

// Mark volunteer as complete and add rating
router.post('/:id/volunteers/:volunteerId/complete', protect, completeVolunteer);

module.exports = router;
