/**
 * User Model
 * 
 * Mongoose schema for user authentication.
 * Passwords are hashed using bcrypt before saving.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // User's full name
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  // User's email (unique identifier)
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  // Hashed password
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  // User role for authorization
  role: {
    type: String,
    enum: ['admin', 'user', 'viewer'],
    default: 'user'
  },
  // Account creation timestamp
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Pre-save hook: Hash password before saving to database
 * Only hashes if the password field has been modified
 */
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Instance method: Compare provided password with hashed password
 * @param {string} candidatePassword - The password to verify
 * @returns {boolean} True if passwords match
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
