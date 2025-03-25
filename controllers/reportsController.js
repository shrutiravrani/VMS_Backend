const Event = require("../models/Event");
const User = require("../models/User");

// 🎯 Volunteer Reports
const getVolunteerReports = async (req, res) => {
  try {
    const volunteerId = req.user.id;

    // Fetch all events the volunteer participated in
    const events = await Event.find({ "applicants.user": volunteerId })
      .select("title date location createdBy applicants description requirements")
      .populate("createdBy", "name email")
      .sort({ date: -1 });

    // Fetch volunteer details with reviews
    const volunteer = await User.findById(volunteerId).select("reviews name email");

    // Calculate total hours (4 hours per event)
    const totalHours = events.length * 4;

    // Calculate participation score (Max 10 events = 100%)
    const participationScore = Math.min((events.length / 10) * 100, 100);

    // Compare participation with other volunteers
    const totalVolunteers = await User.countDocuments({ role: "volunteer" });
    const percentile = Math.floor((events.length / totalVolunteers) * 100);

    // Event participation trends (grouped by month)
    const monthlyParticipation = events.reduce((acc, event) => {
      const month = new Date(event.date).toLocaleString("default", { month: "short" });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    // Calculate status distribution
    const statusDistribution = events.reduce((acc, event) => {
      const status = event.applicants.find(a => a.user.toString() === volunteerId.toString())?.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Calculate upcoming vs completed events
    const now = new Date();
    const upcomingEvents = events.filter(event => new Date(event.date) > now);
    const completedEvents = events.filter(event => new Date(event.date) <= now);

    // Calculate average rating if reviews exist
    const reviews = volunteer.reviews || [];
    const averageRating = reviews.length > 0 
      ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length 
      : 0;

    // Recent activity timeline
    const recentActivity = events
      .slice(0, 5)
      .map(event => ({
        _id: event._id,
        title: event.title,
        date: event.date,
        type: 'event_participation',
        status: event.applicants.find(a => a.user.toString() === volunteerId.toString())?.status
      }));

    res.status(200).json({
      volunteerInfo: {
        name: volunteer.name,
        email: volunteer.email,
        totalEvents: events.length,
        totalHours,
        averageRating: averageRating.toFixed(1)
      },
      eventMetrics: {
        participationScore,
        percentile,
        upcomingCount: upcomingEvents.length,
        completedCount: completedEvents.length,
        statusDistribution
      },
      events: events.map((event) => ({
        _id: event._id,
        title: event.title,
        date: event.date,
        location: event.location,
        organizer: event.createdBy.name,
        description: event.description,
        requirements: event.requirements,
        status: event.applicants.find(a => a.user.toString() === volunteerId.toString())?.status,
        participants: event.applicants.length || 0,
      })),
      monthlyParticipation,
      recentActivity,
      reviews: reviews.map(review => ({
        rating: review.rating,
        comment: review.comment,
        date: review.date
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch volunteer reports", details: error.message });
  }
};

// 🎯 Manager Reports
const getManagerReports = async (req, res) => {
  try {
    const managerId = req.user.id;

    // Fetch manager's events with full details
    const events = await Event.find({ createdBy: managerId })
      .select("title date location applicants description requirements")
      .populate("applicants.user", "name email")
      .sort({ date: -1 });

    const now = new Date();

    // Calculate event statistics
    const totalEvents = events.length;
    const totalApplications = events.reduce((acc, event) => acc + event.applicants.length, 0);
    const avgApplicationsPerEvent = totalApplications / (totalEvents || 1);
    const upcomingEvents = events.filter(event => new Date(event.date) > now);
    const completedEvents = events.filter(event => new Date(event.date) <= now);

    // Calculate application status distribution
    const applicationStatus = events.reduce((acc, event) => {
      event.applicants.forEach(applicant => {
        acc[applicant.status] = (acc[applicant.status] || 0) + 1;
      });
      return acc;
    }, {});

    // Monthly event creation trends
    const monthlyEventTrends = events.reduce((acc, event) => {
      const month = new Date(event.date).toLocaleString("default", { month: "short" });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    // Calculate volunteer engagement metrics
    const volunteerEngagement = events.reduce((acc, event) => {
      event.applicants.forEach(applicant => {
        if (!acc[applicant.user._id]) {
          acc[applicant.user._id] = {
            name: applicant.user.name,
            email: applicant.user.email,
            participationCount: 1
          };
        } else {
          acc[applicant.user._id].participationCount++;
        }
      });
      return acc;
    }, {});

    // Get top performing events
    const topEvents = [...events]
      .sort((a, b) => b.applicants.length - a.applicants.length)
      .slice(0, 5)
      .map(event => ({
        _id: event._id,
        title: event.title,
        date: event.date,
        applicantsCount: event.applicants.length,
        location: event.location
      }));

    // Recent activity timeline
    const recentActivity = events
      .slice(0, 5)
      .map(event => ({
        _id: event._id,
        title: event.title,
        date: event.date,
        type: 'event_created',
        applicantsCount: event.applicants.length
      }));

    res.status(200).json({
      eventMetrics: {
        totalEvents,
        totalApplications,
        avgApplicationsPerEvent: avgApplicationsPerEvent.toFixed(1),
        upcomingEventsCount: upcomingEvents.length,
        completedEventsCount: completedEvents.length
      },
      applicationMetrics: {
        statusDistribution: applicationStatus,
        totalVolunteers: Object.keys(volunteerEngagement).length,
        averageVolunteersPerEvent: (totalApplications / totalEvents).toFixed(1)
      },
      events: events.map(event => ({
        _id: event._id,
        title: event.title,
        date: event.date,
        location: event.location,
        description: event.description,
        requirements: event.requirements,
        applicantsCount: event.applicants.length,
        status: new Date(event.date) > now ? 'Upcoming' : 'Completed'
      })),
      topEvents,
      monthlyEventTrends,
      recentActivity,
      topVolunteers: Object.values(volunteerEngagement)
        .sort((a, b) => b.participationCount - a.participationCount)
        .slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch manager reports", details: error.message });
  }
};

module.exports = { getVolunteerReports, getManagerReports };
