const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    unique: true,
    sparse: true
  },
  mobile: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  place: {
    type: String,
    trim: true
  },
  gender: {
    type: Boolean,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: null
  },
  bookmarkedBooths: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booth'
  }],
  visitedBooths: [{
    booth: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booth'
    },
    visitedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
