const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  requirements: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  applicants: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
      appliedAt: { type: Date, default: Date.now },
      completed: { type: Boolean, default: false },
      rating: { type: Number, min: 1, max: 5 }
    },
  ],
  team: {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // ✅ Keep this to track team members
  }
});

module.exports = mongoose.model('Event', eventSchema);
