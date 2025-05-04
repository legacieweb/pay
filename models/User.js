const mongoose = require('mongoose');

// Transaction sub-schema
const transactionSchema = new mongoose.Schema({
    type: { type: String, enum: ['deposit', 'send', 'receive', 'withdraw'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'completed' },
    date: { type: Date, default: Date.now },
    description: String,
    reference: String,
    to: String,
    from: String
  });

// User schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // Password reset fields
  resetCode: { type: String },
  resetCodeExpires: { type: Date },

  // New fields for wallet
  balance: { type: Number, default: 0 },
  transactions: [transactionSchema]  

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
