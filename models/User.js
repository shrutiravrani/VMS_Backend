const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['volunteer', 'event_manager', 'admin'], required: true, default: 'volunteer' },
  bio: { type: String },
  profileImage: { type: String },
  
  // Volunteer specific fields
  keySkills: [{ type: String }],
  experience: [{
    title: { type: String },
    organization: { type: String },
    duration: { type: String },
    description: { type: String }
  }],
  availability: {
    weekdays: { type: Boolean, default: true },
    weekends: { type: Boolean, default: true },
    specificDays: [{ type: Date }]
  },
  preferredEventTypes: [{ type: String }],
  
  // Events and participation
  eventsParticipated: {
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    ongoing: { type: Number, default: 0 }
  },
  
  // Ratings and Reviews
  ratings: {
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    reviews: [{
      eventManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
      rating: { type: Number, required: true },
      review: { type: String },
      date: { type: Date, default: Date.now }
    }]
  },

  // Achievements and Certifications
  achievements: [{
    title: { type: String },
    issuer: { type: String },
    date: { type: Date },
    description: { type: String }
  }],
  certifications: [{
    name: { type: String },
    organization: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    credentialId: { type: String }
  }],

  // Existing fields
  interestedSkills: { type: [String], default: [] },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  rewards: { type: [String], default: [] }, // Achievements or badges
  
  // Messaging related fields
  unreadMessages: {
    type: Map,
    of: Number,
    default: new Map()
  },
  lastMessageTime: {
    type: Map,
    of: Date,
    default: new Map()
  },
  
  notifications: [
    {
      message: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      isRead: { type: Boolean, default: false },
    },
  ],

  // Password-related fields
  resetPasswordToken: { type: String },
  resetPasswordExpire: { type: Date },
}, {
  timestamps: true
});

// Method to update message counts
UserSchema.methods.updateMessageCount = async function(senderId, increment = true) {
  const currentCount = this.unreadMessages.get(senderId.toString()) || 0;
  this.unreadMessages.set(
    senderId.toString(), 
    increment ? currentCount + 1 : 0
  );
  this.lastMessageTime.set(senderId.toString(), new Date());
  await this.save();
};

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
