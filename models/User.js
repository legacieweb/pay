const mongoose = require('mongoose');

// Transaction sub-schema
const transactionSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  type: { type: String, enum: ['deposit', 'send', 'receive', 'withdraw', 'requested'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'completed' },
  date: { type: Date, default: Date.now },
  description: { type: String },
  reference: { type: String },
  to: { type: String },
  from: { type: String },
  method: { type: String },
  country: { type: String },
  customerEmail: { type: String },
  customerName: { type: String }
});

// User schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // Password reset fields
  resetCode: { type: String },
  resetCodeExpires: { type: Date },

  // Wallet info
  balance: { type: Number, default: 0 },
  defaultAmount: { type: Number, default: null },
  transactions: [transactionSchema],

  // Withdrawal settings
  withdrawalDetails: {
    method: { type: String },
    country: { type: String },
    accountDetails: { type: String }
  }

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
