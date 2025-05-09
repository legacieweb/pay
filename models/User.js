const mongoose = require('mongoose');

// Transaction sub-schema
const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['deposit', 'send', 'receive', 'withdraw', 'requested'], required: true },
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  amount: { type: Number, required: true },
  status: { type: String, default: 'completed' },
  date: { type: Date, default: Date.now },
  description: String,
  reference: String,
  to: String,
  from: String,
  method: String,
  country: String,
  customerEmail: String,
  customerName: String
});

// User schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // Password reset
  resetCode: { type: String },
  resetCodeExpires: { type: Date },

  // Wallet
  balance: { type: Number, default: 0 },
  transactions: [transactionSchema],

  // Withdrawal info
  withdrawalDetails: {
    method: String,
    country: String,
    accountDetails: String
  },

  // Admin controls
  isSuspended: { type: Boolean, default: false },
  isFrozen: { type: Boolean, default: false },

  // Custom request page settings
  customRequestPage: {
    themeColor: { type: String, default: '#22c55e' }, // Tailwind green-500
    animationStyle: { type: String, enum: ['fade', 'slide'], default: 'fade' },
    formStyle: { type: String, enum: ['rounded', 'flat'], default: 'rounded' },
    thankYouMessage: { type: String, default: 'Thank you for your payment! 🎉' }
  }

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
