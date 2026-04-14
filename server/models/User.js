const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    tokenStyle: { type: String, default: 'car' },
    tokenColor: { type: String, default: 'red' },
    stats: {
      gamesPlayed:      { type: Number, default: 0 },
      wins:             { type: Number, default: 0 },
      losses:           { type: Number, default: 0 },
      totalMoneyEarned: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);