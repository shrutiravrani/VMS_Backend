const Event = require('../models/Event');
const Chat = require('../models/Chat'); 
const mongoose = require('mongoose');
const User = require('../models/User');

// Create a new event
const createEvent = async (req, res) => {
  try {
    const { title, description, date, location, requirements } = req.body;

    if (!title || !description || !date || !location) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // ✅ Create the event
    const newEvent = new Event({
      title,
      description,
      date,
      location,
      requirements,
      createdBy: req.user._id,
      team: { members: [req.user._id] }, // ✅ Event manager is added to the team
    });

    await newEvent.save();

    // ✅ Check if chat group already exists
    let chatGroup = await Chat.findOne({ eventId: newEvent._id });

    if (!chatGroup) {
      chatGroup = new Chat({
        eventId: newEvent._id,
        members: [req.user._id], // ✅ Only the event manager initially
        messages: [{ sender: req.user._id, text: `Welcome to the "${title}" chat!` }],
      });

      await chatGroup.save();
    }

    res.status(201).json({ message: 'Event created successfully', event: newEvent });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong', details: error.message });
  }
};

// Fetch events
const getEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, date } = req.query;
    const filter = {};

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: No user data' });
    }

    // Event Managers should see ONLY their events
    // Volunteers should see ALL events
    if (req.user.role === 'event_manager') {
      filter.createdBy = req.user._id;
    }    

    // Check if this is the /created endpoint
    const isCreatedEndpoint = req.path === '/created';

    if (isCreatedEndpoint) {
      // For /created endpoint, return simple array of events without pagination
      const events = await Event.find(filter)
        .select('title')
        .sort({ date: 1 });

      return res.json(events.map(event => ({
        _id: event._id,
        title: event.title
      })));
    }

    // Add date filter if provided
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.date = { $gte: startDate, $lte: endDate };
    }

    console.log('User Role:', req.user.role);
    console.log('User ID:', req.user._id);
    console.log('Filter:', JSON.stringify(filter, null, 2));
    console.log('Page:', page);
    console.log('Limit:', limit);

    // Get total count first
    const total = await Event.countDocuments(filter);
    console.log('Total events found:', total);

    // Fetch events with pagination
    const events = await Event.find(filter)
      .populate('createdBy', 'name email')
      .populate('applicants.user', 'name email')
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    console.log('Events fetched:', events.length);
    console.log('First event date:', events[0]?.date);
    console.log('Last event date:', events[events.length - 1]?.date);

    // Format the response
    const formattedEvents = events.map(event => ({
      ...event.toObject(),
      hasApplied: event.applicants.some(
        applicant => applicant.user._id.toString() === req.user._id.toString()
      )
    }));

    res.status(200).json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      events: formattedEvents,
    });
  } catch (error) {
    console.error('Error in getEvents:', error);
    res.status(500).json({ error: 'Something went wrong', details: error.message });
  }
};


// Apply for an event
const applyForEvent = async (req, res) => {
  try {
    console.log('Received application request for event:', req.params.id);
    console.log('User making request:', req.user._id);

    if (req.user.role === 'event_manager') {
      return res.status(403).json({ error: 'Event managers cannot apply for events' });
    }

    const { id } = req.params;

    // Validate event ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID format:', id);
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    console.log('Searching for event with ID:', id);
    const event = await Event.findById(id);
    console.log('Event found:', event ? 'Yes' : 'No');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if event date has passed
    if (new Date(event.date) < new Date()) {
      return res.status(400).json({ error: 'Cannot apply to past events' });
    }

    // Check if already applied using _id instead of id
    const alreadyApplied = event.applicants.some(
      (applicant) => applicant.user.toString() === req.user._id.toString()
    );

    if (alreadyApplied) {
      return res.status(400).json({ error: 'You have already applied for this event' });
    }

    // Add the user to applicants array with pending status
    event.applicants.push({ 
      user: req.user._id,
      status: 'pending'
    });
    
    await event.save();
    console.log('Application saved successfully');

    // Create notification for event manager
    const managerMessage = `${req.user.name} has applied for your event "${event.title}".`;
    await addNotification(event.createdBy, managerMessage);

    res.status(200).json({ 
      message: 'Application submitted successfully',
      event: {
        _id: event._id,
        title: event.title,
        applicants: event.applicants
      }
    });
  } catch (error) {
    console.error('Error in applyForEvent:', error);
    res.status(500).json({ error: 'Failed to apply for the event', details: error.message });
  }
};


// Fetch applications for an event
const getApplications = async (req, res) => {
  try {
    console.log(`Received request for applications - Event ID: ${req.params.id}`);

    if (req.user.role !== 'event_manager') {
      console.log("Unauthorized user tried accessing applications");
      return res.status(403).json({ error: 'Only event managers can view applications' });
    }

    const { id } = req.params;

    // Validate event ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID format:', id);
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    const event = await Event.findById(id)
      .populate('applicants.user', 'name email bio')
      .populate('createdBy', 'name email');

    if (!event) {
      console.log("Event not found:", id);
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.createdBy._id.toString() !== req.user._id.toString()) {
      console.log("User is not authorized to view these applications");
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Format applications with consistent status casing
    const formattedApplicants = event.applicants.map(applicant => ({
      ...applicant.toObject(),
      status: applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)
    }));

    console.log("Returning applications for event:", id);
    res.status(200).json({ applicants: formattedApplicants });
  } catch (error) {
    console.error("Error Fetching Applications:", error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};


//for volunteer application
const getMyApplications = async (req, res) => {
  try {
    if (req.user.role !== 'volunteer') {
      return res.status(403).json({ message: 'Only volunteers can view their applications' });
    }

    const userId = req.user._id;
    const appliedEvents = await Event.find({ 'applicants.user': userId })
      .select('title date applicants createdBy')
      .populate('createdBy', 'name email');

    const formattedEvents = appliedEvents.map(event => {
      const application = event.applicants.find(a => a.user.toString() === userId.toString());
      return {
        _id: event._id,
        eventTitle: event.title,
        date: event.date,
        eventManager: event.createdBy.name,
        appliedAt: application.appliedAt,
        status: application.status.charAt(0).toUpperCase() + application.status.slice(1)
      };
    });

    res.status(200).json(formattedEvents);
  } catch (error) {
    console.error('Error in getMyApplications:', error);
    res.status(500).json({ message: 'Failed to fetch applied events.', error: error.message });
  }
};


// Update application status
const updateApplicationStatus = async (req, res) => {
  try {
    if (req.user.role !== 'event_manager') {
      return res.status(403).json({ message: 'Only event managers can update application status' });
    }

    const { id, applicationId } = req.params;
    const { status } = req.body;

    // Validate event ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID format:', id);
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Find the application in the applicants array
    const applicationIndex = event.applicants.findIndex(app => app._id.toString() === applicationId);
    if (applicationIndex === -1) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Update the application status
    event.applicants[applicationIndex].status = status;
    
    // If accepting the application, add to team members
    if (status.toLowerCase() === 'accepted') {
      const userId = event.applicants[applicationIndex].user;
      if (!event.team.members.includes(userId)) {
        event.team.members.push(userId);
      }

      // Handle chat group
      let chatGroup = await Chat.findOne({ eventId: event._id });
      if (!chatGroup) {
        chatGroup = new Chat({
          eventId: event._id,
          members: [event.createdBy, ...event.team.members],
          messages: [{ sender: event.createdBy, text: `Welcome to "${event.title}" chat!` }],
        });
      } else {
        if (!chatGroup.members.includes(userId)) {
          chatGroup.members.push(userId);
        }
      }
      await chatGroup.save();
    }

    await event.save();
    console.log(`Successfully updated application ${applicationId} status to ${status}`);
    res.status(200).json({ 
      message: `Application ${status} successfully updated`,
      status: status
    });
  } catch (error) {
    console.error('Error in updateApplicationStatus:', error);
    res.status(500).json({ error: 'Failed to update application status', details: error.message });
  }
};

// Get events for volunteers
const getVolunteerEvents = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all events where the user is a team member
    const events = await Event.find({
      'team.members': userId
    }).populate('event_manager', 'name email');

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch volunteer events', error: error.message });
  }
};

// Get a specific event by ID
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('applicants.user', 'name email')
      .populate('team.members', 'name email');

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Add hasApplied flag for volunteers
    const formattedEvent = {
      ...event.toObject(),
      hasApplied: event.applicants.some(
        applicant => applicant.user._id.toString() === req.user?._id?.toString()
      )
    };

    res.status(200).json(formattedEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event', details: error.message });
  }
};

// Update an event
const updateEvent = async (req, res) => {
  try {
    const { title, description, date, location, requirements } = req.body;
    const { id } = req.params;

    // Find the event
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is authorized to update this event
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this event' });
    }

    // Update event fields
    event.title = title || event.title;
    event.description = description || event.description;
    event.date = date || event.date;
    event.location = location || event.location;
    event.requirements = requirements || event.requirements;

    // Save the updated event
    await event.save();

    res.status(200).json({ 
      message: 'Event updated successfully', 
      event 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to update event', 
      details: error.message 
    });
  }
};

// Delete an event
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the event
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is authorized to delete this event
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this event' });
    }

    // Delete associated chat group if exists
    await Chat.findOneAndDelete({ eventId: id });

    // Delete the event
    await Event.findByIdAndDelete(id);

    res.status(200).json({ 
      message: 'Event deleted successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to delete event', 
      details: error.message 
    });
  }
};

// Get volunteers for a specific event
const getEventVolunteers = async (req, res) => {
  try {
    // Check if event ID is valid
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid event ID format' });
    }

    const event = await Event.findById(req.params.id)
      .populate({
        path: 'applicants.user',
        select: 'name email'
      });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is authorized (event manager of this event)
    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view volunteers for this event' });
    }

    // Filter only accepted applicants
    const volunteers = event.applicants
      .filter(app => app.status === 'accepted')
      .map(app => ({
        _id: app.user._id,
        name: app.user.name,
        email: app.user.email,
        completed: app.completed || false,
        rating: app.rating
      }));

    console.log('Sending volunteers:', volunteers); // Add logging
    res.json({ volunteers }); // Always send as an object with volunteers array
  } catch (error) {
    console.error('Error in getEventVolunteers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mark volunteer as complete and add rating
// @route   POST /api/events/:id/volunteers/:volunteerId/complete
// @access  Private (Event Manager)
const completeVolunteer = async (req, res) => {
  try {
    console.log('Received complete volunteer request:', {
      eventId: req.params.id,
      volunteerId: req.params.volunteerId,
      rating: req.body.rating,
      completed: req.body.completed
    });

    const { rating, completed } = req.body;
    const { id, volunteerId } = req.params;

    // Validate event ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid event ID:', id);
      return res.status(400).json({ message: 'Invalid event ID format' });
    }

    // Validate volunteer ID
    if (!mongoose.Types.ObjectId.isValid(volunteerId)) {
      console.log('Invalid volunteer ID:', volunteerId);
      return res.status(400).json({ message: 'Invalid volunteer ID format' });
    }

    // Validate rating if provided
    if (rating !== null && (rating < 1 || rating > 5)) {
      console.log('Invalid rating value:', rating);
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const event = await Event.findById(id);
    if (!event) {
      console.log('Event not found:', id);
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is authorized (event manager of this event)
    if (event.createdBy.toString() !== req.user._id.toString()) {
      console.log('Unauthorized user:', req.user._id, 'Event creator:', event.createdBy);
      return res.status(403).json({ message: 'Not authorized to manage volunteers for this event' });
    }

    // Find the volunteer's application
    const application = event.applicants.find(
      app => app.user.toString() === volunteerId && app.status === 'accepted'
    );

    if (!application) {
      console.log('Volunteer not found or not accepted:', volunteerId);
      return res.status(404).json({ message: 'Volunteer not found in event or not accepted' });
    }

    // Check if already completed
    if (application.completed) {
      console.log('Volunteer task already completed:', volunteerId);
      return res.status(400).json({ message: 'Volunteer task already marked as complete' });
    }

    // Update application status
    application.completed = completed;
    if (rating) {
      application.rating = rating;
    }

    await event.save();
    console.log('Event updated successfully');

    // If rating provided, update volunteer's ratings in User model
    if (rating) {
      const volunteer = await User.findById(volunteerId);
      if (!volunteer) {
        console.log('Volunteer user not found:', volunteerId);
        return res.status(404).json({ message: 'Volunteer user not found' });
      }

      // Initialize ratings object if it doesn't exist
      if (!volunteer.ratings) {
        volunteer.ratings = {
          averageRating: 0,
          totalRatings: 0,
          reviews: []
        };
      }

      // Check if already rated by this event manager
      const existingRating = volunteer.ratings.reviews.find(
        review => review.eventId.toString() === id && 
                 review.eventManagerId.toString() === req.user._id.toString()
      );

      if (existingRating) {
        console.log('Volunteer already rated for this event');
        return res.status(400).json({ message: 'You have already rated this volunteer for this event' });
      }

      // Add the new rating
      if (!Array.isArray(volunteer.ratings.reviews)) {
        volunteer.ratings.reviews = [];
      }

      volunteer.ratings.reviews.push({
        eventManagerId: req.user._id,
        eventId: id,
        rating: rating,
        date: new Date()
      });

      // Update average rating
      const totalRatings = volunteer.ratings.reviews.length;
      const sumRatings = volunteer.ratings.reviews.reduce((sum, review) => sum + review.rating, 0);
      volunteer.ratings.averageRating = sumRatings / totalRatings;
      volunteer.ratings.totalRatings = totalRatings;

      await volunteer.save();
      console.log('Volunteer ratings updated successfully');

      // Send notification to volunteer
      try {
        const message = `Your task for event "${event.title}" has been marked as complete with a rating of ${rating} stars.`;
        await addNotification(volunteerId, message, 'event');
        console.log('Notification sent to volunteer');
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // Don't fail the whole operation if notification fails
      }
    }

    res.json({ 
      message: 'Volunteer status updated successfully',
      volunteer: {
        _id: volunteerId,
        completed: true,
        rating: rating || null
      }
    });
  } catch (error) {
    console.error('Error in completeVolunteer:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
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
};
