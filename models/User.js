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
  customerName: { type: String },
  fee: { type: Number },
  creditsUsed: { type: Number },
  remainingFee: { type: Number },
  total: { type: Number },
  creditsEarned: { type: Number }
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
  credits: { type: Number, default: 0 },
  savingsBalance: { type: Number, default: 0 },
  defaultAmount: { type: Number, default: null },
  chargeFee: { type: Boolean, default: true },
  feePercentage: { type: Number, default: 2, min: 0, max: 5 },
  paystackPublicKey: { type: String, default: null },
  transactions: [transactionSchema],

  // Referral info
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCode: { type: String, unique: true },

  // Withdrawal settings
  withdrawalDetails: {
    method: { type: String },
    methodLabel: { type: String },
    country: { type: String },
    accountDetails: { type: mongoose.Schema.Types.Mixed }
  },

  // Payout details (saved for convenience)
  payoutDetails: {
    method: { type: String },
    currency: { type: String },
    payoutDetails: { type: mongoose.Schema.Types.Mixed }
  }

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
