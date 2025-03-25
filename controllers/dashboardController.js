const Event = require('../models/Event');
const User = require('../models/User');
const Notification = require('../models/Notification');

const getDashboardData = async (req, res) => {
  try {
    if (!req.user) {
      console.error('❌ ERROR: No user found in request');
      return res.status(401).json({ message: 'Not authorized' });
    }

    console.log('🔍 Dashboard Controller: Request User:', req.user);
    const { role, _id } = req.user;

    // Count unread notifications
    const unreadNotificationsCount = await Notification.countDocuments({ user: _id, isRead: false });

    let data = { notificationsCount: unreadNotificationsCount };

    if (role === 'volunteer') {
      console.log('Fetching data for volunteer...');
      const joinedEvents = await Event.find({ 'applicants.user': _id }).select('title date location');

      const upcomingEvents = joinedEvents.filter(event => new Date(event.date) > new Date());
      data = { ...data, eventsCount: joinedEvents.length, upcomingEvents };
    } else if (role === 'event_manager') {
      console.log('Fetching data for event manager...');
      const createdEvents = await Event.find({ createdBy: _id }).select('title date applicants');

      const pendingApplications = createdEvents.reduce((count, event) => {
        return count + event.applicants.filter(app => app.status === 'pending').length;
      }, 0);

      data = { ...data, eventsCount: createdEvents.length, pendingApplications };
    }

    console.log('✅ Dashboard Data:', data);
    res.status(200).json(data);
  } catch (error) {
    console.error('❌ Dashboard Error:', error.message);
    res.status(500).json({ error: 'Failed to load dashboard data', details: error.message });
  }
};

module.exports = { getDashboardData };
