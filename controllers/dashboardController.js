const Event = require('../models/Event');
const User = require('../models/User');

const getDashboardData = async (req, res) => {
  try {
    if (!req.user) {
      console.error('❌ ERROR: No user found in request');
      return res.status(401).json({ message: 'Not authorized' });
    }

    console.log('🔍 Dashboard Controller: Request User:', req.user);
    const { role, _id } = req.user;

    let data = {};

    if (role === 'volunteer') {
      console.log('Fetching data for volunteer...');
      const joinedEvents = await Event.find({ 'applicants.user': _id }).select('title date location');
      console.log('Found joined events:', joinedEvents);

      const upcomingEvents = joinedEvents.filter(event => {
        const eventDate = new Date(event.date);
        const now = new Date();
        return eventDate > now;
      });
      console.log('Upcoming events:', upcomingEvents);
      
      data = { 
        eventsCount: joinedEvents.length, 
        upcomingEvents 
      };
    } else if (role === 'event_manager') {
      console.log('Fetching data for event manager...');
      const createdEvents = await Event.find({ createdBy: _id }).select('title date applicants');
      console.log('Found created events:', createdEvents);

      const pendingApplications = createdEvents.reduce((count, event) => {
        return count + event.applicants.filter(app => app.status === 'pending').length;
      }, 0);

      data = { 
        eventsCount: createdEvents.length, 
        pendingApplications 
      };
    } else {
      console.error('❌ Invalid user role:', role);
      return res.status(400).json({ message: 'Invalid user role' });
    }

    console.log('✅ Dashboard Data:', data);
    res.status(200).json(data);
  } catch (error) {
    console.error('❌ Dashboard Error:', error);
    res.status(500).json({ 
      error: 'Failed to load dashboard data', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = { getDashboardData };
